// The concept pages' samples, each a test of what the page claims.
import {
  actors,
  apply,
  init,
  legalInputs,
  load,
  randomBot,
  replayInputs,
  save,
  view,
  viewEntities,
  viewEvents,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  fuzz,
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { deck, hand, highCard, playCard, roundWon, table } from "./highCard";

const players = ["ann", "bob"];

test("starting and playing a game", () => {
  // #region play
  // A game starts from its players and a seed
  let state = init(highCard, { players, seed: "demo" });

  // Who may act, and what they may do
  actors(highCard, state); // ["ann"]
  const [first] = legalInputs(highCard, state, "ann");
  // { player: "ann", action: "playCard", args: { id: "card#…" } }

  // An input is applied to a state; the result is a new state and events
  const out = apply(highCard, state, first!);
  if (out.ok) state = out.state;

  // An illegal input is a result, not an error
  apply(highCard, state, playCard.by("ann", { id: "card#1" }));
  // { ok: false, reason: "It is bob's turn, not ann's" }
  // #endregion play
  expect(actors(highCard, init(highCard, { players, seed: "demo" }))).toEqual([
    "ann",
  ]);
  expect(first).toMatchObject({ player: "ann", action: "playCard" });
  expect(out.ok).toBe(true);
  expect(apply(highCard, state, playCard.by("ann", { id: "card#1" }))).toEqual({
    ok: false,
    reason: "It is bob's turn, not ann's",
  });
});

test("views hide what a player can't see", () => {
  const state = init(highCard, { players, seed: "demo" });
  // #region view
  const v = view(highCard, state, "bob");
  viewEntities(v, hand.of("bob")); // bob's card, with its rank
  viewEntities(v, hand.of("ann")); // [{ ref: "r…", zone: "hand:ann", hidden: true }]
  viewEntities(v, deck); // every card hidden; refs renewed by each shuffle
  // #endregion view
  const mine = viewEntities(v, hand.of("bob"));
  const theirs = viewEntities(v, hand.of("ann"));
  expect(mine).toHaveLength(1);
  expect("props" in mine[0]!).toBe(true);
  expect(theirs).toHaveLength(1);
  expect(theirs[0]).toEqual({
    ref: theirs[0]!.ref,
    zone: "hand:ann",
    hidden: true,
  });
  expect(viewEntities(v, deck).every((e) => "hidden" in e)).toBe(true);
});

test("events say what changed, and each player gets their share", () => {
  const state = init(highCard, { players, seed: "demo" });
  // #region events
  const out = apply(highCard, state, legalInputs(highCard, state, "ann")[0]!);
  if (!out.ok) throw new Error(out.reason);
  out.events.map((e) => e.type); // ["moved", "vars", "flow"]

  // What bob may see: ann's card moved from her hand to the table, face up
  const bobs = viewEvents(highCard, out.events, "bob");
  // #endregion events
  expect(out.events.map((e) => e.type)).toEqual(["moved", "vars", "flow"]);
  const moved = bobs.find((e) => e.type === "moved");
  expect(moved?.type === "moved" && "props" in moved.entities[0]!).toBe(true);
  expect(moved?.type === "moved" && moved.to).toBe(table.id);
});

test("an effect is caused, logged and resolved", () => {
  let s = init(highCard, { players, seed: "demo" });
  s = applyOrThrow(highCard, s, legalInputs(highCard, s, "ann")[0]!);
  const out = apply(highCard, s, legalInputs(highCard, s, "bob")[0]!);
  if (!out.ok) throw new Error(out.reason);
  const won = out.events.find((e) => e.type === "effect");
  expect(won).toMatchObject({ type: "effect", name: roundWon.name });
  expect(Object.values(out.state.vars.score).reduce((a, b) => a + b)).toBe(1);
});

test("a game is its seed and its inputs", () => {
  const { states, inputs } = playBots(highCard, {
    players,
    seed: "demo",
    bots: randomBot("demo"),
    maxInputs: 100,
  });
  const end = states.at(-1)!;
  // #region determinism
  // The same seed and inputs always reach the same state
  const again = replayInputs(highCard, { players, seed: "demo" }, inputs);

  // A save is the state as JSON, stamped so it loads only into this game
  const text = save(highCard, again);
  const loaded = load(highCard, text);
  // #endregion determinism
  expect(end.status).toBe("finished");
  expect(hashState(again)).toBe(hashState(end));
  expect(loaded).toEqual(end);
});

test("fuzz: random games finish, and nothing hidden leaks", () => {
  // #region fuzz
  const report = fuzz(highCard, {
    seeds: 50,
    players: ["ann", "bob", "cat"],
    maxInputs: 60,
  });
  report.failures; // [] — legal inputs, views and events all check out
  // #endregion fuzz
  expect(report.failures).toEqual([]);
  expect(report.finished).toBe(50);
});
