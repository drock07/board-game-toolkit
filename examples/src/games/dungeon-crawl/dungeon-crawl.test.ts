import {
  apply,
  init,
  legalInputs,
  randomBot,
  replayInputs,
  view,
  type State,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { again, attack, dismantle, dungeonCrawl, flee, move, next } from ".";
import { SIZE, type Monster, type Vars } from "./game";

const players = ["p1"];
const start = (seed = "d") => init(dungeonCrawl, { players, seed });
/** What the game waits for, by label. */
const waiting = (s: State<Vars>) =>
  view(dungeonCrawl, s, "p1").waiting.map((w) => w.label);
/** The state with its vars changed, to stage a room. */
const edit = (s: State<Vars>, fn: (vars: Vars) => void): State<Vars> => {
  const vars = structuredClone(s.vars);
  fn(vars);
  return { ...s, vars };
};
const rat = (): Monster => ({
  name: "Rat",
  hp: 4,
  maxHp: 4,
  attack: 0,
  defense: 8,
});
const step = (s: State<Vars>, input: Parameters<typeof applyOrThrow>[2]) =>
  applyOrThrow(dungeonCrawl, s, input);

/** Attacks until the fight ends one way or another. */
function fight(s: State<Vars>) {
  while (waiting(s)[0] === "Attack or flee") s = step(s, attack.by("p1"));
  return s;
}

describe("dungeon crawl", () => {
  test("generates a 5x5 dungeon from the corner to the boss", () => {
    const { grid, player } = start().vars;
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
    const s = start();
    expect(legalInputs(dungeonCrawl, s, "p1").filter(move.is)).toHaveLength(2);
    expect(apply(dungeonCrawl, s, move.by("p1", { row: 1, col: 1 }))).toEqual({
      ok: false,
      reason: "You can only move to a neighboring room",
    });
  });

  test("a monster's room starts a fight; killing it runs its handler", () => {
    let s = edit(start(), (v) => {
      v.grid[0]![1] = {
        type: "monster",
        revealed: true,
        visited: false,
        monster: rat(),
      };
      v.player.attack = 10;
    });
    s = step(s, move.by("p1", { row: 0, col: 1 }));
    expect(waiting(s)).toEqual(["Attack or flee"]);
    expect(s.vars.combat).toEqual({ playerRoll: null, monsterRoll: null });
    s = fight(s);
    expect(s.vars.grid[0]![1]!.monster!.hp).toBe(0);
    expect(s.vars.log.at(-1)).toBe("Rat defeated!");
    expect(s.vars.combat).toBeNull();
    expect(waiting(s)).toEqual(["Move"]);
  });

  test("each side's last roll is shown for the fight", () => {
    let s = edit(start(), (v) => {
      v.grid[0]![1] = {
        type: "monster",
        revealed: true,
        visited: false,
        monster: { ...rat(), hp: 999, maxHp: 999 },
      };
      v.player.hp = 99;
    });
    s = step(s, move.by("p1", { row: 0, col: 1 }));
    s = step(s, attack.by("p1"));
    const { playerRoll, monsterRoll } = s.vars.combat!;
    expect(s.vars.log.slice(-2)[0]).toMatch(`You rolled ${playerRoll}`);
    expect(s.vars.log.at(-1)).toMatch(`Rat rolled ${monsterRoll}`);
  });

  test("fleeing raises `fled` from the action; the monster stays", () => {
    let fled = false;
    for (let i = 0; i < 20 && !fled; i++) {
      let s = edit(start(`flee${i}`), (v) => {
        v.grid[0]![1] = {
          type: "monster",
          revealed: true,
          visited: false,
          monster: rat(),
        };
        v.player.hp = 99;
      });
      s = step(s, move.by("p1", { row: 0, col: 1 }));
      s = step(s, flee.by("p1"));
      if (waiting(s)[0] !== "Move") {
        // A failed flee lets the monster strike back
        expect(s.vars.combat!.monsterRoll).not.toBeNull();
        continue;
      }
      fled = true;
      expect(s.vars.log.at(-1)).toBe("You escaped!");
      expect(s.vars.grid[0]![1]!.monster!.hp).toBe(4);
      expect(s.vars.combat).toBeNull();
    }
    expect(fled).toBe(true);
  });

  test("a trap can be retried until dismantled for its reward", () => {
    let s = edit(start(), (v) => {
      v.grid[0]![1] = {
        type: "trap",
        revealed: true,
        visited: false,
        item: { type: "weapon", name: "Fine Sword", value: 4 },
      };
      v.player.hp = 99;
    });
    s = step(s, move.by("p1", { row: 0, col: 1 }));
    expect(s.vars.trap).toMatchObject({
      reward: { name: "Fine Sword" },
      lastRoll: null,
      damage: 0,
    });
    let tries = 0;
    while (waiting(s)[0] === "Dismantle the trap or leave it") {
      s = step(s, dismantle.by("p1"));
      tries++;
    }
    expect(waiting(s)).toEqual(["Continue"]);
    expect(s.vars.player.attack).toBe(4);
    expect(s.vars.grid[0]![1]!.item).toBeUndefined();
    expect(s.vars.trap!.damage).toBe(99 - s.vars.player.hp);
    expect(s.vars.trap!.damage > 0).toBe(tries > 1);
    // The trap's panel stays up until you move on
    s = step(s, next.by("p1"));
    expect(s.vars.trap).toBeNull();
    expect(waiting(s)).toEqual(["Move"]);
  });

  test("treasure is collected, then waits to continue", () => {
    let s = edit(start(), (v) => {
      v.grid[0]![1] = {
        type: "treasure",
        revealed: true,
        visited: false,
        item: { type: "shield", name: "Sturdy Shield", value: 2 },
      };
    });
    s = step(s, move.by("p1", { row: 0, col: 1 }));
    expect(s.vars.player.defense).toBe(2);
    expect(s.vars.grid[0]![1]!.item).toBeUndefined();
    expect(waiting(s)).toEqual(["Continue"]);
    s = step(s, next.by("p1"));
    expect(waiting(s)).toEqual(["Move"]);
  });

  test("killing the boss resolves as victory, not killed (outermost guard first)", () => {
    let s = edit(start(), (v) => {
      Object.assign(v.player, {
        row: SIZE - 1,
        col: SIZE - 2,
        hp: 999,
        attack: 50,
      });
    });
    s = step(s, move.by("p1", { row: SIZE - 1, col: SIZE - 1 }));
    expect(waiting(s)).toEqual(["Attack or flee"]);
    s = fight(s);
    // Both guards held after the killing blow; the outer one won
    expect(s.vars.grid[SIZE - 1]![SIZE - 1]!.monster!.hp).toBe(0);
    expect(s.vars.result).toBe("victory");
    expect(s.vars.log).not.toContain("Dragon defeated!");
    expect(s.vars.log.at(-1)).toBe("Victory! You conquered the dungeon!");
    expect(s.vars.combat).toBeNull();
    expect(waiting(s)).toEqual(["Play again"]);
    // Playing again generates a fresh dungeon
    s = step(s, again.by("p1"));
    expect(s.vars).toMatchObject({
      result: null,
      player: { row: 0, col: 0, hp: 20 },
    });
    expect(waiting(s)).toEqual(["Move"]);
  });

  test("dying anywhere ends the run in defeat", () => {
    let s = edit(start(), (v) => {
      v.grid[0]![1] = {
        type: "monster",
        revealed: true,
        visited: false,
        monster: { ...rat(), hp: 999, maxHp: 999, attack: 5 },
      };
      v.player.hp = 1;
    });
    s = step(s, move.by("p1", { row: 0, col: 1 }));
    s = fight(s);
    expect(s.vars.result).toBe("defeat");
    expect(s.vars.combat).toBeNull();
    expect(waiting(s)).toEqual(["Play again"]);
  });
});

test("golden replay", async () => {
  const { states, inputs } = playBots(dungeonCrawl, {
    players,
    seed: "golden",
    bots: randomBot("golden"),
    maxInputs: 150,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(dungeonCrawl, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
