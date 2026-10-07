import {
  apply,
  init,
  legalInputs,
  replayInputs,
  turnNode,
  view,
  type GameInput,
  type State,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
  type SyncBot,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { again, roll, rollFive, score, toggleHold } from ".";
import {
  CATEGORIES,
  MAX_ROLLS,
  scoreFor,
  scoreSummary,
  type Category,
  type Vars,
} from "./game";

const players = ["p1"];
const start = (seed: string) => init(rollFive, { players, seed });
const act = (s: State<Vars>, input: GameInput<typeof rollFive>) =>
  applyOrThrow(rollFive, s, input);
/** Rolls this turn, as the UI reads them. */
const rolls = (s: State<Vars>) =>
  turnNode.shown(view(rollFive, s, "p1"))?.counts.roll ?? 0;

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

  test("an extra Roll Five earns the bonus once the box holds 50", () => {
    let s = act(start("bonus"), roll.by("p1"));
    s = {
      ...s,
      vars: {
        ...s.vars,
        dice: [3, 3, 3, 3, 3],
        scores: { ...s.vars.scores, rollFive: 50 },
      },
    };
    s = act(s, score.by("p1", { category: "threes" }));
    expect(s.vars.scores.threes).toBe(15);
    expect(s.vars.bonus).toBe(100);
  });
});

describe("turns", () => {
  test("a turn needs a roll, allows three, and holds dice between rolls", () => {
    let s = start("turn");
    expect(view(rollFive, s, "p1").waiting).toEqual([
      { label: "Roll or score", actors: ["p1"] },
    ]);
    expect(s.vars.dice).toEqual([]);
    expect(rolls(s)).toBe(0);
    // Only rolling starts a turn
    expect(legalInputs(rollFive, s, "p1")).toEqual([roll.by("p1")]);
    expect(apply(rollFive, s, score.by("p1", { category: "chance" })).ok).toBe(
      false,
    );
    expect(apply(rollFive, s, toggleHold.by("p1", { index: 0 })).ok).toBe(
      false,
    );

    s = act(s, roll.by("p1"));
    const first = s.vars.dice;
    expect(first).toHaveLength(5);
    expect(rolls(s)).toBe(1);
    s = act(s, toggleHold.by("p1", { index: 2 }));
    expect(s.vars.held[2]).toBe(true);
    s = act(s, roll.by("p1"));
    expect(s.vars.dice[2]).toBe(first[2]);
    s = act(s, roll.by("p1"));
    expect(rolls(s)).toBe(MAX_ROLLS);
    expect(apply(rollFive, s, roll.by("p1")).ok).toBe(false);
    expect(legalInputs(rollFive, s, "p1").some(roll.is)).toBe(false);
    // Holding after the last roll is pointless, so it isn't allowed
    expect(apply(rollFive, s, toggleHold.by("p1", { index: 0 }))).toEqual({
      ok: false,
      reason: "No rolls left",
    });
    expect(legalInputs(rollFive, s, "p1").some(toggleHold.is)).toBe(false);

    const dice = s.vars.dice;
    s = act(s, score.by("p1", { category: "chance" }));
    expect(s.vars.scores.chance).toBe(dice.reduce((a, b) => a + b));
    // The next round starts with fresh dice and no rolls
    expect(s.vars.dice).toEqual([]);
    expect(s.vars.held).toEqual([false, false, false, false, false]);
    expect(rolls(s)).toBe(0);
    expect(apply(rollFive, s, score.by("p1", { category: "chance" })).ok).toBe(
      false,
    );
  });

  test("a category can only be scored once", () => {
    let s = act(start("x"), roll.by("p1"));
    s = act(s, score.by("p1", { category: "aces" }));
    s = act(s, roll.by("p1"));
    expect(apply(rollFive, s, score.by("p1", { category: "aces" }))).toEqual({
      ok: false,
      reason: "Already scored",
    });
  });
});

/** Rolls three times, then scores the best open category. */
const strategy: SyncBot<Vars, GameInput<typeof rollFive>> = (
  legal,
  { view: v },
) => {
  const replay = legal.find(again.is);
  if (replay) return replay;
  const rolled = turnNode.shown(v)?.counts.roll ?? 0;
  const next = legal.find(roll.is);
  if (rolled < MAX_ROLLS && next) return next;
  const open = CATEGORIES.filter((c) => v.vars.scores[c] === null);
  const best = open.reduce((a, b) =>
    scoreFor(b, v.vars.dice) > scoreFor(a, v.vars.dice) ? b : a,
  );
  return score.by("p1", { category: best });
};

test("a full game: 13 rounds, then play again resets the scores", () => {
  const { states, inputs } = playBots(rollFive, {
    players,
    seed: "full",
    bots: strategy,
    maxInputs: 13 * 4,
  });
  let s = states.at(-1)!;
  expect(inputs.filter(score.is)).toHaveLength(13);
  expect(Object.values(s.vars.scores).every((v) => v !== null)).toBe(true);
  expect(view(rollFive, s, "p1").waiting).toEqual([
    { label: "Play again", actors: ["p1"] },
  ]);
  s = act(s, again.by("p1"));
  expect(Object.values(s.vars.scores).every((v) => v === null)).toBe(true);
  expect(legalInputs(rollFive, s, "p1")).toEqual([roll.by("p1")]);
});

test("golden replay", async () => {
  const { states, inputs } = playBots(rollFive, {
    players,
    seed: "golden",
    bots: strategy,
    maxInputs: 60,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(rollFive, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
