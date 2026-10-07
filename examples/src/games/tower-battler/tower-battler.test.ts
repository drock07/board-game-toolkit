import {
  apply,
  init,
  randomBot,
  replayInputs,
  view,
  type Applied,
  type EntityId,
  type State,
} from "@drock07/board-game-toolkit-engine";
import {
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { again, endTurn, playCard, towerBattler } from ".";
import {
  discard,
  drawPile,
  hand,
  intentFor,
  TURN_LABEL,
  type Card,
  type Vars,
} from "./game";

const start = (seed = "t") => init(towerBattler, { players: ["p1"], seed });

function ok(out: Applied<Vars>) {
  if (!out.ok) throw new Error(out.reason);
  return out;
}

const ids = (s: State<Vars>, z: { id: string }) => s.zones[z.id]!;
const label = (s: State<Vars>) => view(towerBattler, s, "p1").waiting[0]?.label;

/** Edits a state between inputs; the flow (and its open prompt) is unchanged. */
function edit(s: State<Vars>, fn: (s: State<Vars>) => void): State<Vars> {
  const out = structuredClone(s);
  fn(out);
  return out;
}

/** Moves a card named `name` to the top of the hand, from wherever it is. */
function toHand(s: State<Vars>, name: string): EntityId {
  const e = Object.values(s.entities).find(
    (e) => (e.props as Card).name === name,
  )!;
  s.zones[e.zone] = s.zones[e.zone]!.filter((x) => x !== e.id);
  s.zones[hand.id] = [e.id, ...s.zones[hand.id]!.filter((x) => x !== e.id)];
  s.entities[e.id] = { ...e, zone: hand.id };
  return e.id;
}

describe("tower battler", () => {
  test("starts with five cards, full energy and the enemy's intent", () => {
    const s = start();
    expect(ids(s, hand)).toHaveLength(5);
    expect(s.vars).toMatchObject({
      player: { hp: 50, energy: 3, block: 0 },
      enemy: { hp: 40, intent: 8 },
      turn: 1,
    });
    expect(label(s)).toBe(TURN_LABEL);
  });

  test("cards cost energy and resolve their effects", () => {
    let bash = "";
    let s = edit(start(), (s) => {
      bash = toHand(s, "Bash");
      s.vars.player.energy = 2;
    });
    s = ok(apply(towerBattler, s, playCard.by("p1", { card: bash }))).state;
    expect(s.vars.enemy.hp).toBe(32);
    expect(s.vars.player).toMatchObject({ energy: 0, block: 2 });
    // The turn stays open, but nothing is affordable now
    expect(label(s)).toBe(TURN_LABEL);
    const another = ids(s, hand)[0]!;
    expect(
      apply(towerBattler, s, playCard.by("p1", { card: another })),
    ).toEqual({ ok: false, reason: "Not enough energy" });
  });

  test("the enemy falling mid-turn wins at once (outcomes are checked after every action)", () => {
    let strike = "";
    let s = edit(start(), (s) => {
      strike = toHand(s, "Strike");
      s.vars.enemy.hp = 6;
    });
    const out = ok(apply(towerBattler, s, playCard.by("p1", { card: strike })));
    s = out.state;
    expect(s.vars.result).toBe("win");
    expect(label(s)).toBe("Play again");
    // The enemy never attacked
    expect(out.events.some((e) => e.type === "effect")).toBe(false);
    expect(s.vars.player.hp).toBe(50);
  });

  test("drawing two with one card left reshuffles the discards instead of failing", () => {
    let sprint = "";
    const s = edit(start(), (s) => {
      sprint = toHand(s, "Sprint");
      const rest = ids(s, drawPile).slice(1);
      s.zones[drawPile.id] = ids(s, drawPile).slice(0, 1);
      s.zones[discard.id] = rest;
      for (const id of rest)
        s.entities[id] = { ...s.entities[id]!, zone: discard.id };
    });
    expect(ids(s, drawPile)).toHaveLength(1);
    const before = ids(s, hand).length;
    const out = ok(apply(towerBattler, s, playCard.by("p1", { card: sprint })));
    expect(ids(out.state, hand)).toHaveLength(before - 1 + 2);
    expect(
      out.events.some((e) => e.type === "shuffled" && e.zone === drawPile.id),
    ).toBe(true);
  });

  test("ending the turn: the enemy attacks through block, then a new turn starts", () => {
    const s = edit(start(), (s) => {
      s.vars.player.block = 3;
    });
    const out = ok(apply(towerBattler, s, endTurn.by("p1")));
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: "effect",
        name: "enemyAttack",
        data: { damage: 5, blocked: 3 },
      }),
    );
    expect(out.state.vars.player).toMatchObject({
      hp: 45,
      block: 0,
      energy: 3,
    });
    expect(out.state.vars).toMatchObject({
      turn: 2,
      enemy: { intent: intentFor(2) },
    });
    expect(ids(out.state, hand)).toHaveLength(5);
    expect(intentFor(3)).toBe(14);
  });

  test("falling to zero loses; playing again rebuilds the deck", () => {
    let s = edit(start(), (s) => {
      s.vars.player.hp = 1;
    });
    s = ok(apply(towerBattler, s, endTurn.by("p1"))).state;
    expect(s.vars.result).toBe("lose");
    expect(s.vars.turn).toBe(1);
    expect(label(s)).toBe("Play again");
    s = ok(apply(towerBattler, s, again.by("p1"))).state;
    expect(s.vars).toMatchObject({
      result: null,
      player: { hp: 50 },
      enemy: { hp: 40 },
    });
    expect(ids(s, hand)).toHaveLength(5);
    expect(ids(s, discard)).toHaveLength(0);
  });
});

test("golden replay", async () => {
  const { states, inputs } = playBots(towerBattler, {
    players: ["p1"],
    seed: "golden",
    bots: randomBot("golden"),
    maxInputs: 120,
  });
  const golden = {
    players: ["p1"],
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(towerBattler, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
