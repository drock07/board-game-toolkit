// Zone options: a "top" pile shows only its top entity (the engine turns
// the rest face down, with `flipped` events), and moves can land at the
// bottom of a zone.
import { assert, test } from "vitest";
import {
  apply,
  defaultNodes,
  define,
  entity,
  init,
  view,
  viewEntities,
  zone,
} from "../index.js";
import { applyOrThrow, checkEvents, fuzz } from "../testing/index.js";

const card = entity<{ n: number }>("card");
const deck = zone("deck", { holds: card, visibility: "hidden" });
const pile = zone("pile", { holds: card, visibility: "top" });
const hand = zone("hand", { holds: card });

const { rules, action, loop, prompt } = define<{ n: number }>({
  zones: [deck, pile, hand],
}).withNodes(defaultNodes);

const play = action("play", {
  validate: (s) => (s.count(deck) ? true : "The deck is empty"),
  execute: (tx) => void tx.moveTop(deck, pile),
});
const take = action("take", {
  validate: (s) => (s.count(pile) ? true : "The pile is empty"),
  execute: (tx) => void tx.moveTop(pile, hand),
});
const tuck = action("tuck", {
  validate: (s) => (s.count(hand) ? true : "Nothing to tuck"),
  execute: (tx) => void tx.moveTop(hand, deck, 1, { at: "bottom" }),
});
const game = rules({
  players: 2,
  setup: (tx) => {
    tx.vars = { n: 0 };
    for (let n = 1; n <= 6; n++) tx.create(card, { n }, deck);
  },
  flow: loop({}, prompt(play, take, tuck)),
});

const shown = (s: ReturnType<typeof init<{ n: number }, unknown>>) =>
  viewEntities(view(game, s, "p2"), pile).map((e) =>
    "hidden" in e ? "?" : e.props.n,
  );

test("a top pile shows only its top card, and taking one shows the next", () => {
  let s = init(game, { players: ["p1", "p2"], seed: "x" });
  for (let i = 0; i < 3; i++) {
    const out = apply(game, s, play.by("p1"));
    assert.ok(out.ok);
    checkEvents(game, s, out.events, out.state);
    s = out.state;
  }
  assert.deepEqual(shown(s), [3, "?", "?"]);
  const out = apply(game, s, take.by("p1"));
  assert.ok(out.ok);
  // The newly exposed card turns face up, as an event
  assert.ok(out.events.some((e) => e.type === "flipped"));
  checkEvents(game, s, out.events, out.state);
  assert.deepEqual(shown(out.state), [2, "?"]);
});

test("a move can land at the bottom of a zone", () => {
  let s = init(game, { players: ["p1", "p2"], seed: "x" });
  s = applyOrThrow(game, s, play.by("p1"));
  s = applyOrThrow(game, s, take.by("p1"));
  const out = apply(game, s, tuck.by("p1"));
  assert.ok(out.ok);
  checkEvents(game, s, out.events, out.state);
  const order = out.state.zones[deck.id]!.map(
    (id) => (out.state.entities[id]!.props as { n: number }).n,
  );
  assert.deepEqual(order, [2, 3, 4, 5, 6, 1]);
});

test("fuzz: views and events stay exact through top piles and bottom moves", () => {
  const report = fuzz(game, {
    seeds: 30,
    players: ["p1", "p2"],
    maxInputs: 40,
  });
  assert.deepEqual(report.failures, []);
});
