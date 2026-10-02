import {
  apply,
  init,
  legalInputs,
  randomBot,
  replay,
  type ApplyResult,
  type Input,
  type Json,
  type Tx,
} from "@drock07/board-game-toolkit-engine";
import {
  hashState,
  playBots,
  transact,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { dungeonCrawl } from ".";
import { SIZE, type Monster, type Types } from "./impl";

type Result = ApplyResult<Types>;

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const start = (seed = "d") => init(dungeonCrawl, { players: ["p1"], seed });
const node = (r: Result) => r.prompts[0]!.node;
const act = (r: Result, action: string, args?: Json): Input => ({
  prompt: r.prompts[0]!.id,
  player: "p1",
  action,
  ...(args === undefined ? {} : { args }),
});
const cont = (r: Result): Input => ({
  prompt: r.prompts[0]!.id,
  player: "p1",
  continue: true,
});
const edit = (r: Result, fn: (tx: Tx<Types>) => void): Result => ({
  ...r,
  state: transact(r.state, fn).state,
});
const rat = (): Monster => ({
  name: "Rat",
  hp: 4,
  maxHp: 4,
  attack: 0,
  defense: 8,
});

/** Attacks until the fight ends one way or another. */
function fight(r: Result): Result {
  while (node(r) === "combat.playerAttack")
    r = ok(apply(dungeonCrawl, r.state, act(r, "attack")));
  return r;
}

const flowExits = (r: Result) =>
  r.events.flatMap((e) =>
    e.type === "flow" && e.kind === "exit" && e.outcome
      ? [`${e.node}:${e.outcome}`]
      : [],
  );

describe("dungeon crawl", () => {
  test("generates a 5x5 dungeon from the corner to the boss", () => {
    const { grid, player } = start().state.vars;
    const types = grid.flat().map((room) => room.type);
    expect(types.filter((t) => t === "monster")).toHaveLength(8);
    expect(types.filter((t) => t === "treasure")).toHaveLength(8);
    expect(types.filter((t) => t === "trap")).toHaveLength(7);
    expect(grid[SIZE - 1]![SIZE - 1]).toMatchObject({
      type: "boss",
      monster: { name: "Dragon", hp: 24 },
    });
    expect(player).toMatchObject({ row: 0, col: 0, hp: 20 });
    expect([
      grid[0]![1]!.revealed,
      grid[1]![0]!.revealed,
      grid[1]![1]!.revealed,
    ]).toEqual([true, true, false]);
  });

  test("moves are to neighboring rooms only", () => {
    const r = start();
    expect(
      legalInputs(dungeonCrawl, r.state, "p1").filter(
        (i) => "action" in i && i.action === "move",
      ),
    ).toHaveLength(2);
    expect(
      apply(dungeonCrawl, r.state, act(r, "move", { row: 1, col: 1 })),
    ).toMatchObject({
      ok: false,
      error: { message: "You can only move to a neighboring room" },
    });
  });

  test("a monster's room starts a fight in the combat subflow; killing it runs its on flow", () => {
    let r = edit(start(), (tx) => {
      tx.vars.grid[0]![1] = {
        type: "monster",
        revealed: true,
        visited: false,
        monster: rat(),
      };
      tx.vars.player.attack = 10;
    });
    r = ok(apply(dungeonCrawl, r.state, act(r, "move", { row: 0, col: 1 })));
    expect(node(r)).toBe("combat.playerAttack");
    expect(
      r.state.flow.fibers.f0!.stack.find((f) => f.node === "combat.fight")!
        .locals,
    ).toMatchObject({ monster: "Rat" });
    r = fight(r);
    expect(r.state.vars.grid[0]![1]!.monster!.hp).toBe(0);
    expect(r.state.vars.log.at(-1)).toBe("Rat defeated!");
    expect(node(r)).toBe("move");
  });

  test("fleeing raises `fled` with tx.exit; the monster stays", () => {
    let fled = false;
    for (let i = 0; i < 20 && !fled; i++) {
      let r = edit(start(`flee${i}`), (tx) => {
        tx.vars.grid[0]![1] = {
          type: "monster",
          revealed: true,
          visited: false,
          monster: rat(),
        };
        tx.vars.player.hp = 99;
      });
      r = ok(apply(dungeonCrawl, r.state, act(r, "move", { row: 0, col: 1 })));
      r = ok(apply(dungeonCrawl, r.state, act(r, "flee")));
      if (node(r) !== "move") continue;
      fled = true;
      expect(r.state.vars.log.at(-1)).toBe("You escaped!");
      expect(r.state.vars.grid[0]![1]!.monster!.hp).toBe(4);
      expect(flowExits(r)).toContain("combat.fight:fled");
    }
    expect(fled).toBe(true);
  });

  test("a trap can be dismantled for its reward (endWhen) or skipped", () => {
    let r = edit(start(), (tx) => {
      tx.vars.grid[0]![1] = {
        type: "trap",
        revealed: true,
        visited: false,
        item: { type: "weapon", name: "Fine Sword", value: 4 },
      };
      tx.vars.player.hp = 99;
    });
    r = ok(apply(dungeonCrawl, r.state, act(r, "move", { row: 0, col: 1 })));
    while (node(r) === "trap.trapChoice")
      r = ok(apply(dungeonCrawl, r.state, act(r, "dismantle")));
    expect(node(r)).toBe("trap.trapPause");
    expect(r.state.vars.player.attack).toBe(4);
    expect(r.state.vars.grid[0]![1]!.item).toBeUndefined();
  });

  test("killing the boss resolves as victory, not killed (outermost guard first)", () => {
    let r = edit(start(), (tx) => {
      Object.assign(tx.vars.player, {
        row: SIZE - 1,
        col: SIZE - 2,
        hp: 999,
        attack: 50,
      });
    });
    r = ok(
      apply(
        dungeonCrawl,
        r.state,
        act(r, "move", { row: SIZE - 1, col: SIZE - 1 }),
      ),
    );
    expect(node(r)).toBe("combat.playerAttack");
    r = fight(r);
    // Both guards held after the killing blow; the outer one won
    expect(r.state.vars.grid[SIZE - 1]![SIZE - 1]!.monster!.hp).toBe(0);
    expect(r.state.vars.result).toBe("victory");
    expect(flowExits(r)).toContain("run:victory");
    expect(flowExits(r)).not.toContain("combat.fight:killed");
    expect(r.state.vars.log).not.toContain("Dragon defeated!");
    expect(node(r)).toBe("wonPause");
    // Playing again generates a fresh dungeon
    r = ok(apply(dungeonCrawl, r.state, cont(r)));
    expect(r.state.vars).toMatchObject({
      result: null,
      player: { row: 0, col: 0, hp: 20 },
    });
  });

  test("dying anywhere ends the run in defeat", () => {
    let r = edit(start(), (tx) => {
      tx.vars.grid[0]![1] = {
        type: "monster",
        revealed: true,
        visited: false,
        monster: { ...rat(), hp: 999, maxHp: 999, attack: 5 },
      };
      tx.vars.player.hp = 1;
    });
    r = ok(apply(dungeonCrawl, r.state, act(r, "move", { row: 0, col: 1 })));
    r = fight(r);
    expect(r.state.vars.result).toBe("defeat");
    expect(node(r)).toBe("lostPause");
  });
});

test("golden replay", async () => {
  const { results, inputs } = playBots(dungeonCrawl, {
    players: ["p1"],
    seed: "golden",
    bots: randomBot(),
    maxInputs: 150,
  });
  const golden = {
    players: ["p1"],
    seed: "golden",
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  expect(hashState(replay(dungeonCrawl, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
