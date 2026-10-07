import { assert, test } from "vitest";
import { current, defaultNodes, define, init, legalInputs } from "../index.js";
import { applyOrThrow, fuzz, randomBot } from "../testing/index.js";
import {
  CATEGORIES,
  dice,
  die,
  rollFive,
  scoreFor,
  total,
  type Vars,
} from "./rollFive.js";
import { turnNode } from "./turn.js";

const roll = rollFive.action("roll");
const hold = rollFive.action("hold");
const score = rollFive.action("score");
const players = ["ann", "bob"];

test("the turn node lowers with its limits and first-answer rule", () => {
  const turnSpec = JSON.stringify(rollFive.spec.flow);
  assert.ok(turnSpec.includes('"kind":"turn"'));
  assert.ok(turnSpec.includes('"limits":{"roll":3}'));
  assert.ok(turnSpec.includes('"first":["roll"]'));
  assert.deepEqual(JSON.parse(JSON.stringify(rollFive.spec)), rollFive.spec);
});

test("you must roll first, may roll three times, and hold between rolls", () => {
  let s = init(rollFive, { players, seed: "r" });
  assert.strictEqual(s.zones[dice.id]!.length, 5);
  assert.deepEqual(legalInputs(rollFive, s), [roll.by("ann")]);
  s = applyOrThrow(rollFive, s, roll.by("ann"));
  const kinds = new Set(legalInputs(rollFive, s).map((i) => i.action));
  assert.deepEqual([...kinds].sort(), ["hold", "roll", "score"]);
  assert.strictEqual(
    legalInputs(rollFive, s).filter(score.is).length,
    CATEGORIES.length,
  );
  const held = s.zones[dice.id]![0]!;
  s = applyOrThrow(rollFive, s, hold.by("ann", { die: held }));
  const before = s.entities[held]!;
  assert.ok(die.is(before) && before.props.held);
  s = applyOrThrow(rollFive, s, roll.by("ann"));
  assert.strictEqual(
    (s.entities[held]!.props as { value: number }).value,
    before.props.value,
    "a held die keeps its value",
  );
  s = applyOrThrow(rollFive, s, roll.by("ann"));
  assert.ok(!legalInputs(rollFive, s).some(roll.is), "no fourth roll");
  const frame = s.flow.find((f) => f.id === "turn")!;
  assert.deepEqual(frame.data, { answers: 4, counts: { roll: 3, hold: 1 } });
  assert.strictEqual(current(rollFive, s), "ann");
});

test("scoring ends the turn, clears holds, and the next turn starts fresh", () => {
  let s = init(rollFive, { players, seed: "s" });
  s = applyOrThrow(rollFive, s, roll.by("ann"));
  s = applyOrThrow(rollFive, s, hold.by("ann", { die: s.zones[dice.id]![2]! }));
  const v = s.zones[dice.id]!.map(
    (id) => (s.entities[id]!.props as { value: number }).value,
  );
  s = applyOrThrow(rollFive, s, score.by("ann", { category: "chance" }));
  assert.strictEqual(
    s.vars.scores.ann!.chance,
    v.reduce((a, b) => a + b, 0),
  );
  assert.ok(
    s.zones[dice.id]!.every(
      (id) => (s.entities[id]!.props as { held: boolean }).held === false,
    ),
  );
  assert.strictEqual(current(rollFive, s), "bob");
  assert.deepEqual(legalInputs(rollFive, s), [roll.by("bob")]);
  assert.strictEqual(
    s.flow.find((f) => f.id === "turn")!.data,
    undefined,
    "a fresh turn frame",
  );
});

test("scoreFor and total", () => {
  assert.strictEqual(scoreFor("chance", [1, 2, 3, 4, 5]), 15);
  assert.strictEqual(scoreFor("sixes", [6, 6, 1, 2, 6]), 18);
  assert.strictEqual(scoreFor("fullHouse", [2, 2, 3, 3, 3]), 25);
  assert.strictEqual(scoreFor("fullHouse", [2, 2, 2, 2, 3]), 0);
  assert.strictEqual(scoreFor("smallStraight", [1, 2, 3, 4, 6]), 30);
  assert.strictEqual(scoreFor("largeStraight", [2, 3, 4, 5, 6]), 40);
  assert.strictEqual(scoreFor("rollFive", [4, 4, 4, 4, 4]), 50);
  assert.strictEqual(scoreFor("fourOfAKind", [4, 4, 4, 4, 1]), 17);
  const sheet = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    (typeof CATEGORIES)[number],
    number | null
  >;
  sheet.sixes = 30;
  sheet.fives = 20;
  sheet.fours = 16;
  assert.strictEqual(total(sheet, 100), 66 + 35 + 100);
});

test("thirteen rounds each, then totals", () => {
  const report = fuzz(rollFive, {
    seeds: 20,
    players: ["solo"],
    maxInputs: 300,
  });
  assert.deepEqual(report.failures, []);
  assert.strictEqual(report.finished, 20);
  let s = init(rollFive, { players, seed: "full" });
  const bot = randomBot("full");
  while (s.status === "running")
    s = applyOrThrow(rollFive, s, bot(legalInputs(rollFive, s)) as never);
  const result = s.result as { totals: Record<string, number> };
  for (const p of players) {
    assert.ok(
      CATEGORIES.every((c) => s.vars.scores[p]![c] !== null),
      "every category scored",
    );
    assert.strictEqual(
      result.totals[p],
      total(s.vars.scores[p]!, s.vars.bonus[p]!),
    );
  }
});

test("types: updates are typed by the entity, limits and first by the actions", () => {
  const { turn, action, step } = define<Vars>({ zones: [dice] }).withNodes([
    ...defaultNodes,
    turnNode,
  ]);
  step((tx) => {
    const d = tx.entities(dice)[0]!;
    tx.update(d, { held: true });
    // @ts-expect-error -- not a die prop
    tx.update(d, { colour: "red" });
    // @ts-expect-error -- wrong type
    tx.update(d, { value: "six" });
  });
  const a = action("a", { execute: () => {} });
  const b = action("b", { execute: () => {} });
  turn({ limits: { a: 1 }, first: ["b"] }, a, b);
  // @ts-expect-error -- not one of the turn's actions
  turn({ limits: { c: 1 } }, a, b);
  // @ts-expect-error -- not one of the turn's actions
  turn({ first: ["c"] }, a, b);
  // @ts-expect-error -- a die id is a string
  hold.by("ann", { die: 3 });
});
