import { assert, test } from "vitest";
import { check, current, init, legalInputs, view } from "../index.js";
import { applyOrThrow, fuzz } from "../testing/index.js";
import {
  card,
  crazyEights,
  deck,
  discard,
  hand,
  SUITS,
} from "./crazyEights.js";

const players = ["ann", "bob", "cat"];
const play = crazyEights.action("play");
const draw = crazyEights.action("draw");
const pass = crazyEights.action("pass");

test("the game carries its kinds; the spec is still JSON", () => {
  assert.deepEqual(Object.keys(crazyEights.kinds).sort(), [
    "seq",
    "step",
    "turn",
    "turns",
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(crazyEights.spec)),
    crazyEights.spec,
  );
  assert.deepEqual(Object.keys(crazyEights.impl.conditions), ["turns.until"]);
  assert.deepEqual(Object.keys(crazyEights.impl.actions), [
    "play",
    "draw",
    "pass",
  ]);
});

test("deals five each, turns one up, and follows its suit", () => {
  const s = init(crazyEights, { players, seed: "deal" });
  for (const p of players)
    assert.strictEqual(s.zones[hand.of(p).id]!.length, 5);
  assert.strictEqual(s.zones.discard!.length, 1);
  assert.strictEqual(s.zones.deck!.length, 52 - 16);
  const top = s.entities[s.zones.discard![0]!]!;
  assert.ok(card.is(top));
  assert.strictEqual(s.vars.suit, top.props.suit);
  assert.strictEqual(current(crazyEights, s), "ann");
});

test("hands are secret, the discard is public, the deck is hidden", () => {
  const s = init(crazyEights, { players, seed: "deal" });
  const v = view(crazyEights, s, "ann");
  for (const ref of v.zones[hand.of("ann").id]!)
    assert.ok(card.is(v.entities[ref]!));
  for (const ref of v.zones[hand.of("bob").id]!)
    assert.ok("hidden" in v.entities[ref]!);
  for (const ref of v.zones.discard!) assert.ok(card.is(v.entities[ref]!));
  for (const ref of v.zones.deck!) assert.ok("hidden" in v.entities[ref]!);
});

test("an eight is offered once per suit and names the suit when played", () => {
  // Find a seed where the first player holds an eight
  let s = init(crazyEights, { players, seed: "e0" });
  for (
    let i = 1;
    !s.zones[hand.of("ann").id]!.some(
      (id) => (s.entities[id]!.props as { rank: number }).rank === 8,
    );
    i++
  ) {
    s = init(crazyEights, { players, seed: `e${i}` });
  }
  const eight = s.zones[hand.of("ann").id]!.find(
    (id) => (s.entities[id]!.props as { rank: number }).rank === 8,
  )!;
  const offers = legalInputs(crazyEights, s)
    .filter(play.is)
    .filter((i) => i.args.card === eight);
  assert.deepEqual(
    offers.map((i) => i.args.suit),
    [...SUITS],
  );
  const next = applyOrThrow(
    crazyEights,
    s,
    play.by("ann", { card: eight, suit: "♦" }),
  );
  assert.strictEqual(next.vars.suit, "♦");
  assert.strictEqual(next.zones.discard![0], eight);
  assert.strictEqual(current(crazyEights, next), "bob");
  // Not an eight: no suit allowed
  assert.strictEqual(
    check(
      crazyEights,
      s,
      play.by("ann", { card: s.zones[hand.of("bob").id]![0]! }),
    ),
    "That move isn't available",
  );
});

test("draw and pass are gated on what you hold and what's left", () => {
  let s = init(crazyEights, { players, seed: "gate" });
  const me = current(crazyEights, s)!;
  const playableNow = legalInputs(crazyEights, s).filter(play.is).length;
  if (playableNow) {
    assert.strictEqual(
      check(crazyEights, s, draw.by(me)),
      "You have a card you can play",
    );
  } else {
    assert.strictEqual(check(crazyEights, s, draw.by(me)), true);
    s = applyOrThrow(crazyEights, s, draw.by(me));
    assert.strictEqual(
      current(crazyEights, s),
      me,
      "drawing doesn't end the turn",
    );
  }
  assert.strictEqual(
    check(crazyEights, s, pass.by(me)),
    "You can still play or draw",
  );
  void deck;
  void discard;
});

test("fuzz: random games finish with an empty hand and never leak a hand", () => {
  const report = fuzz(crazyEights, { seeds: 60, players, maxInputs: 600 });
  assert.deepEqual(report.failures, []);
  assert.ok(report.finished >= 55, `finished ${report.finished}`);
});
