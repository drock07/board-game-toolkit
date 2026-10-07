import { assert, test } from "vitest";
import type { EntityId, State, ZoneId } from "../index.js";
import { actors, apply, init, legalInputs } from "../index.js";
import { applyOrThrow, fuzz } from "../testing/index.js";
import {
  deck,
  discard,
  hand,
  plusTwo,
  type Card,
  type Vars,
} from "./plusTwo.js";

const players = ["p1", "p2", "p3"];
const play = plusTwo.action("play");
const stack = plusTwo.action("stack");
const accept = plusTwo.action("accept");

/** Moves entities to the top of a zone by editing the JSON state. */
function arrange(s: State<Vars>, moves: [EntityId[], ZoneId][]): State<Vars> {
  const out = { ...s, entities: { ...s.entities }, zones: { ...s.zones } };
  for (const [ids, to] of moves) {
    for (const id of ids) {
      const from = out.entities[id]!.zone;
      out.zones[from] = out.zones[from]!.filter((x) => x !== id);
      out.entities[id] = { ...out.entities[id]!, zone: to };
    }
    out.zones[to] = [...ids, ...out.zones[to]!.filter((x) => !ids.includes(x))];
  }
  return out;
}

const cards = (s: State<Vars>, want: Partial<Card>) =>
  Object.values(s.entities)
    .filter((e) =>
      Object.entries(want).every(
        ([k, v]) => (e.props as Card)[k as keyof Card] === v,
      ),
    )
    .map((e) => e.id);
const handOf = (s: State<Vars>, p: string) => s.zones[hand.of(p).id]!;

/**
 * A dealt game where p1 holds the red +2s, p2 one blue +2, p3 none, and the
 * discard's top is a red 3, so p1 can play a +2 at once.
 */
function setUp(): State<Vars> {
  let s = init(plusTwo, { players, seed: "s" });
  const twos = cards(s, { value: "+2" });
  const red = cards(s, { color: "red", value: "+2" });
  const blue = cards(s, { color: "blue", value: "+2" })[0]!;
  // Every other +2 goes back to the deck; then the deal we want
  s = arrange(s, [
    [twos.filter((id) => !red.includes(id) && id !== blue), deck.id],
    [red, hand.of("p1").id],
    [[blue], hand.of("p2").id],
    [[cards(s, { color: "red", value: "3" })[0]!], discard.id],
  ]);
  return s;
}

test("playing a +2 opens a window: anyone else may stack, the victim may take it", () => {
  let s = setUp();
  s = applyOrThrow(plusTwo, s, play.by("p1", { card: handOf(s, "p1")[0]! }));
  assert.strictEqual(s.vars.penalty, 2);
  assert.strictEqual(s.vars.victim, "p2");
  assert.deepEqual(actors(plusTwo, s), ["p2", "p3"]);
  // p3 has no +2 and isn't the victim: an actor with nothing to do
  assert.deepEqual(legalInputs(plusTwo, s, "p3"), []);
  assert.deepEqual(
    legalInputs(plusTwo, s, "p2")
      .map((i) => i.action)
      .sort(),
    ["accept", "stack"],
  );
  assert.deepEqual(apply(plusTwo, s, accept.by("p3")), {
    ok: false,
    reason: "The penalty isn't yours",
  });
});

test("taking the penalty draws it, closes the window, and play moves on", () => {
  let s = setUp();
  s = applyOrThrow(plusTwo, s, play.by("p1", { card: handOf(s, "p1")[0]! }));
  const before = handOf(s, "p2").length;
  s = applyOrThrow(plusTwo, s, accept.by("p2"));
  assert.strictEqual(handOf(s, "p2").length, before + 2);
  assert.strictEqual(s.vars.penalty, 0);
  assert.strictEqual(s.vars.victim, null);
  assert.deepEqual(actors(plusTwo, s), ["p2"]);
  assert.ok(
    legalInputs(plusTwo, s).every((i) =>
      ["play", "draw", "pass"].includes(i.action),
    ),
  );
});

test("stacking passes a bigger penalty on; the old victim can't take it", () => {
  let s = setUp();
  s = applyOrThrow(plusTwo, s, play.by("p1", { card: handOf(s, "p1")[0]! }));
  const blue = cards(s, { color: "blue", value: "+2" }).find((id) =>
    handOf(s, "p2").includes(id),
  )!;
  s = applyOrThrow(plusTwo, s, stack.by("p2", { card: blue }));
  assert.strictEqual(s.vars.penalty, 4);
  assert.strictEqual(s.vars.victim, "p3");
  // p2 stacked, so they're out of this round of answers altogether
  assert.deepEqual(apply(plusTwo, s, accept.by("p2")), {
    ok: false,
    reason: "p2 has nothing to do right now",
  });
  // p1 (holding another red +2) or p3 may stack; p3 may take it
  assert.deepEqual(actors(plusTwo, s), ["p1", "p3"]);
  const before = handOf(s, "p3").length;
  s = applyOrThrow(plusTwo, s, accept.by("p3"));
  assert.strictEqual(handOf(s, "p3").length, before + 4);
  // The window closes; p1's turn is over and p2 plays next
  assert.deepEqual(actors(plusTwo, s), ["p2"]);
  assert.strictEqual(s.fibers && Object.keys(s.fibers).length, 0);
});

test("fuzz: random games finish and never leak a hand", () => {
  const report = fuzz(plusTwo, { seeds: 40, players, maxInputs: 600 });
  assert.deepEqual(report.failures, []);
  assert.ok(report.finished >= 35, `${report.finished} of 40 finished`);
});
