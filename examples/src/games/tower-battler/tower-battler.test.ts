import {
  apply,
  init,
  randomBot,
  replay,
  type ApplyResult,
  type Input,
  type Tx,
} from "@drock07/board-game-toolkit-engine";
import {
  checkInvariants,
  hashState,
  playBots,
  transact,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { towerBattler } from ".";
import { intentFor, type Types } from "./impl";

type Result = ApplyResult<Types>;

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const start = (seed = "t") => init(towerBattler, { players: ["p1"], seed });
const prompt = (r: Result) => r.prompts[0]!;
const input = (r: Result, action: string, card?: string): Input => ({
  prompt: prompt(r).id,
  player: "p1",
  action,
  ...(card ? { args: { card } } : {}),
});

/** Edits a state mid-turn; the flow (and its open prompt) is unchanged. */
function edit(r: Result, fn: (tx: Tx<Types>) => void): Result {
  return { ...r, state: transact(r.state, fn).state };
}

/** Puts a card named `name` on top of the hand, from wherever it is. */
function toHand(tx: Tx<Types>, name: string): string {
  const id = Object.values(tx.state.entities).find(
    (e) => e.props.name === name,
  )!.id;
  tx.move(id, "hand");
  return id;
}

const handNames = (r: Result) =>
  r.state.zones.hand.items.map((id) => r.state.entities[id]!.props.name);

describe("tower battler", () => {
  test("starts with five cards, full energy and the enemy's intent", () => {
    const r = start();
    expect(r.state.zones.hand.items).toHaveLength(5);
    expect(r.state.vars).toMatchObject({
      player: { hp: 50, energy: 3, block: 0 },
      enemy: { hp: 40, intent: 8 },
      turn: 1,
    });
    expect(prompt(r)).toMatchObject({ node: "playerTurn" });
  });

  test("cards cost energy and resolve their effects", () => {
    let r = edit(start(), (tx) => {
      toHand(tx, "Bash");
      tx.vars.player.energy = 2;
    });
    const bash = r.state.zones.hand.items[0]!;
    r = ok(apply(towerBattler, r.state, input(r, "playCard", bash)));
    expect(r.state.vars.enemy.hp).toBe(32);
    expect(r.state.vars.player).toMatchObject({ energy: 0, block: 2 });
    const another = r.state.zones.hand.items[0]!;
    expect(
      apply(towerBattler, r.state, input(r, "playCard", another)),
    ).toMatchObject({ ok: false, error: { message: "Not enough energy" } });
  });

  test("the enemy falling mid-turn wins at once (guards run after every action)", () => {
    let r = edit(start(), (tx) => {
      toHand(tx, "Strike");
      tx.vars.enemy.hp = 6;
    });
    r = ok(
      apply(
        towerBattler,
        r.state,
        input(r, "playCard", r.state.zones.hand.items[0]),
      ),
    );
    expect(r.state.vars.result).toBe("win");
    expect(prompt(r).node).toBe("again");
    // The enemy never attacked
    expect(r.events.some((e) => e.type === "custom")).toBe(false);
    expect(r.state.vars.player.hp).toBe(50);
  });

  test("drawing two with one card left reshuffles the discards instead of failing", () => {
    let sprint = "";
    let r = edit(start(), (tx) => {
      sprint = toHand(tx, "Sprint");
      tx.move(tx.state.zones.draw.items.slice(1), "discard");
    });
    expect(r.state.zones.draw.items).toHaveLength(1);
    const before = r.state.zones.hand.items.length;
    r = ok(apply(towerBattler, r.state, input(r, "playCard", sprint)));
    expect(r.state.zones.hand.items).toHaveLength(before - 1 + 2);
    expect(
      r.events.some((e) => e.type === "shuffled" && e.zone === "draw"),
    ).toBe(true);
    expect(checkInvariants(r.state)).toEqual([]);
  });

  test("ending the turn: the enemy attacks through block, then a new turn starts", () => {
    let r = edit(start(), (tx) => {
      tx.vars.player.block = 3;
    });
    r = ok(apply(towerBattler, r.state, input(r, "endTurn")));
    expect(r.state.vars.player).toMatchObject({ hp: 45, block: 0, energy: 3 });
    expect(r.state.vars).toMatchObject({
      turn: 2,
      enemy: { intent: intentFor(2) },
    });
    expect(r.state.zones.hand.items).toHaveLength(5);
    expect(intentFor(3)).toBe(14);
  });

  test("falling to zero loses; playing again rebuilds the deck", () => {
    let r = edit(start(), (tx) => {
      tx.vars.player.hp = 1;
    });
    r = ok(apply(towerBattler, r.state, input(r, "endTurn")));
    expect(r.state.vars.result).toBe("lose");
    expect(prompt(r).node).toBe("again");
    r = ok(
      apply(towerBattler, r.state, {
        prompt: prompt(r).id,
        player: "p1",
        continue: true,
      }),
    );
    expect(r.state.vars).toMatchObject({
      result: null,
      player: { hp: 50 },
      enemy: { hp: 40 },
    });
    expect(handNames(r)).toHaveLength(5);
    expect(r.state.zones.discard.items).toHaveLength(0);
  });
});

test("golden replay", async () => {
  const { results, inputs } = playBots(towerBattler, {
    players: ["p1"],
    seed: "golden",
    bots: randomBot(),
    maxInputs: 120,
  });
  const golden = {
    players: ["p1"],
    seed: "golden",
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  expect(hashState(replay(towerBattler, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
