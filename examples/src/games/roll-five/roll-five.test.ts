import {
  apply,
  init,
  replay,
  type ApplyResult,
  type Input,
  type Json,
} from "@drock07/board-game-toolkit-engine";
import { hashState, record } from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { rollFive } from ".";
import {
  CATEGORIES,
  scoreFor,
  scoreSummary,
  type Category,
  type TurnLocals,
  type Types,
  type Vars,
} from "./impl";

type Result = ApplyResult<Types>;

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const input = (r: Result, rest: Partial<Input>): Input =>
  ({ prompt: r.prompts[0]!.id, player: "p1", ...rest }) as Input;
const act = (r: Result, action: string, args?: Json) =>
  apply(
    rollFive,
    r.state,
    input(r, args === undefined ? { action } : { action, args }),
  );
const turn = (r: Result) =>
  // Frames hold locals untyped; the `turn` node's are TurnLocals
  r.state.flow.fibers.f0!.stack.at(-1)!.locals as unknown as TurnLocals;

describe("scoring", () => {
  test.each<[Category, number[], number]>([
    ["aces", [1, 1, 3, 4, 1], 3],
    ["sixes", [6, 6, 2, 6, 1], 18],
    ["threeOfAKind", [2, 2, 2, 5, 6], 17],
    ["threeOfAKind", [2, 2, 3, 5, 6], 0],
    ["fourOfAKind", [4, 4, 4, 4, 1], 17],
    ["fullHouse", [3, 3, 5, 5, 5], 25],
    ["fullHouse", [5, 5, 5, 5, 5], 0],
    ["smallStraight", [1, 2, 3, 4, 6], 30],
    ["smallStraight", [1, 3, 4, 5, 6], 30],
    ["largeStraight", [2, 3, 4, 5, 6], 40],
    ["largeStraight", [1, 2, 3, 4, 6], 0],
    ["rollFive", [4, 4, 4, 4, 4], 50],
    ["chance", [1, 2, 3, 4, 6], 16],
  ])("%s %j = %i", (category, dice, expected) => {
    expect(scoreFor(category, dice)).toBe(expected);
  });

  test("summary with upper bonus", () => {
    const scores = Object.fromEntries(
      CATEGORIES.map((c) => [c, null]),
    ) as Vars["scores"];
    Object.assign(scores, {
      aces: 3,
      twos: 6,
      threes: 9,
      fours: 12,
      fives: 15,
      sixes: 18,
      chance: 20,
    });
    expect(scoreSummary({ scores, bonus: 100 })).toEqual({
      upperSubtotal: 63,
      upperBonus: 35,
      upperTotal: 98,
      lowerTotal: 120,
      grandTotal: 218,
    });
  });
});

describe("turns", () => {
  test("a turn needs a roll, allows three, and holds dice between rolls", () => {
    let r = init(rollFive, { players: ["p1"], seed: "turn" });
    expect(r.prompts).toMatchObject([
      {
        node: "turn",
        actions: [
          { name: "roll", ends: false },
          { name: "toggleHold", ends: false },
          { name: "score", ends: true },
        ],
      },
    ]);
    expect(turn(r)).toEqual({
      dice: [],
      held: [false, false, false, false, false],
      rolls: 0,
    });
    expect(act(r, "score", { category: "chance" })).toMatchObject({
      ok: false,
      error: { message: "Roll first" },
    });
    expect(act(r, "toggleHold", { index: 0 })).toMatchObject({
      ok: false,
      error: { message: "Roll first" },
    });

    r = ok(act(r, "roll"));
    const first = turn(r).dice;
    expect(first).toHaveLength(5);
    r = ok(act(r, "toggleHold", { index: 2 }));
    r = ok(act(r, "roll"));
    expect(turn(r).dice[2]).toBe(first[2]);
    r = ok(act(r, "roll"));
    expect(turn(r).rolls).toBe(3);
    expect(act(r, "roll")).toMatchObject({
      ok: false,
      error: { code: "validation_failed", message: "No rolls left" },
    });

    const dice = turn(r).dice;
    r = ok(act(r, "score", { category: "chance" }));
    expect(r.state.vars.scores.chance).toBe(dice.reduce((a, b) => a + b));
    // The next round starts with fresh dice
    expect(turn(r)).toEqual({
      dice: [],
      held: [false, false, false, false, false],
      rolls: 0,
    });
    expect(act(r, "score", { category: "chance" })).toMatchObject({
      ok: false,
    });
  });

  test("a category can only be scored once", () => {
    let r = ok(act(init(rollFive, { players: ["p1"], seed: "x" }), "roll"));
    r = ok(act(r, "score", { category: "aces" }));
    r = ok(act(r, "roll"));
    expect(act(r, "score", { category: "aces" })).toMatchObject({
      ok: false,
      error: { message: "Already scored" },
    });
  });
});

/** Rolls three times, then scores the best open category. */
function strategy(r: Result): Input {
  const p = r.prompts[0]!;
  if (p.node === "over") return input(r, { continue: true });
  const t = turn(r);
  if (t.rolls < 3) return input(r, { action: "roll" });
  const open = CATEGORIES.filter((c) => r.state.vars.scores[c] === null);
  const best = open.reduce((a, b) =>
    scoreFor(b, t.dice) > scoreFor(a, t.dice) ? b : a,
  );
  return input(r, { action: "score", args: { category: best } });
}

test("a full game: 13 rounds, then play again resets the scores", () => {
  let r = init(rollFive, { players: ["p1"], seed: "full" });
  while (r.prompts[0]!.node !== "over")
    r = ok(apply(rollFive, r.state, strategy(r)));
  expect(Object.values(r.state.vars.scores).every((v) => v !== null)).toBe(
    true,
  );
  r = ok(apply(rollFive, r.state, strategy(r)));
  expect(r.prompts[0]!.node).toBe("turn");
  expect(Object.values(r.state.vars.scores).every((v) => v === null)).toBe(
    true,
  );
});

test("golden replay", async () => {
  const { golden, results } = record(
    rollFive,
    { players: ["p1"], seed: "golden", maxInputs: 60 },
    strategy,
  );
  expect(hashState(replay(rollFive, golden))).toBe(golden.finalStateHash);
  expect(results.at(-1)!.state).toEqual(replay(rollFive, golden));
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
