import {
  apply,
  init,
  legalInputs,
  replayInputs,
  view,
  type GameInput,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
  type SyncBot,
} from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { discard, draw, sandbox, shuffleBack } from ".";
import { deck, discardPile, hand, type Vars } from "./game";

const players = ["p1"];

test("draw, discard and shuffle back; the table never closes", () => {
  let s = init(sandbox, { players, seed: "s" });
  expect(s.zones[deck.id]).toHaveLength(52);
  expect(apply(sandbox, s, shuffleBack.by("p1"))).toEqual({
    ok: false,
    reason: "The discard pile is empty",
  });

  const top = s.zones[deck.id]![0]!;
  s = applyOrThrow(sandbox, s, draw.by("p1"));
  expect(s.zones[hand.id]).toEqual([top]);
  expect(apply(sandbox, s, discard.by("p1", { card: "nope" }))).toEqual({
    ok: false,
    reason: "That card isn't in your hand",
  });
  expect(legalInputs(sandbox, s, "p1")).toEqual([
    draw.by("p1"),
    discard.by("p1", { card: top }),
  ]);
  s = applyOrThrow(sandbox, s, discard.by("p1", { card: top }));
  expect(s.zones[discardPile.id]).toEqual([top]);
  s = applyOrThrow(sandbox, s, shuffleBack.by("p1"));
  expect(s.zones[deck.id]).toHaveLength(52);
  expect(s.status).toBe("running");
  expect(view(sandbox, s, "p1").waiting).toEqual([
    { label: "Table", actors: ["p1"] },
  ]);
});

test("the deck is hidden; drawn cards show in the public hand", () => {
  let s = init(sandbox, { players, seed: "s" });
  s = applyOrThrow(sandbox, s, draw.by("p1"));
  const v = view(sandbox, s, "p1");
  for (const ref of v.zones[deck.id]!)
    expect(v.entities[ref]).toMatchObject({ hidden: true });
  const [ref] = v.zones[hand.id]!;
  expect(v.entities[ref!]).toMatchObject({ type: "card" });
});

test("the deck can be emptied", () => {
  let s = init(sandbox, { players, seed: "s" });
  for (let i = 0; i < 52; i++) s = applyOrThrow(sandbox, s, draw.by("p1"));
  expect(apply(sandbox, s, draw.by("p1"))).toEqual({
    ok: false,
    reason: "The deck is empty",
  });
  expect(legalInputs(sandbox, s, "p1").map((i) => i.action)).not.toContain(
    "draw",
  );
});

/** Draws twice as often as anything else, so hands grow. */
const driver: SyncBot<Vars, GameInput<typeof sandbox>> = (legal, { random }) =>
  random.pick(
    legal.flatMap((i): (typeof legal)[number][] =>
      i.action === "draw" ? [i, i] : [i],
    ),
  );

test("golden replay", async () => {
  const { states, inputs } = playBots(sandbox, {
    players,
    seed: "golden",
    bots: driver,
    maxInputs: 80,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(sandbox, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
