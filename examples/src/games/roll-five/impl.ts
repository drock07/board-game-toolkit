import {
  D6,
  type GameImpl,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

export const CATEGORIES = [
  "aces",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "threeOfAKind",
  "fourOfAKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "rollFive",
  "chance",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const MAX_ROLLS = 3;
export const ROLL_FIVE_BONUS = 100;

export interface Vars {
  /** Points per category; null until scored. */
  scores: Record<Category, number | null>;
  /** Bonus points for extra Roll Fives. */
  bonus: number;
}

/** One round's dice. Reset every round by the `turn` node's locals. */
export interface TurnLocals {
  /** Empty until the first roll. */
  dice: number[];
  held: boolean[];
  rolls: number;
}

export type Types = TypesFor<
  typeof spec,
  { vars: Vars; locals: { turn: TurnLocals } }
>;

export type HoldArgs = { index: number };
export type ScoreArgs = { category: Category };

function counts(dice: readonly number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) out[d]!++;
  return out;
}

const sum = (dice: readonly number[]) => dice.reduce((a, b) => a + b, 0);
const hasNOfAKind = (dice: readonly number[], n: number) =>
  counts(dice).some((c) => c >= n);

function longestRun(dice: readonly number[]): number {
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  unique.forEach((d, i) => {
    run = i > 0 && d === unique[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

/** What the dice would score in a category. */
export function scoreFor(category: Category, dice: readonly number[]): number {
  const c = counts(dice);
  switch (category) {
    case "aces":
    case "twos":
    case "threes":
    case "fours":
    case "fives":
    case "sixes": {
      const face = CATEGORIES.indexOf(category) + 1;
      return c[face]! * face;
    }
    case "threeOfAKind":
      return hasNOfAKind(dice, 3) ? sum(dice) : 0;
    case "fourOfAKind":
      return hasNOfAKind(dice, 4) ? sum(dice) : 0;
    case "fullHouse": {
      const groups = c.filter((n) => n > 0).sort();
      return groups.length === 2 && groups[0] === 2 ? 25 : 0;
    }
    case "smallStraight":
      return longestRun(dice) >= 4 ? 30 : 0;
    case "largeStraight":
      return longestRun(dice) >= 5 ? 40 : 0;
    case "rollFive":
      return hasNOfAKind(dice, 5) ? 50 : 0;
    case "chance":
      return sum(dice);
  }
}

export interface ScoreSummary {
  upperSubtotal: number;
  upperBonus: number;
  upperTotal: number;
  lowerTotal: number;
  grandTotal: number;
}

export function scoreSummary(vars: Vars): ScoreSummary {
  const value = (c: Category) => vars.scores[c] ?? 0;
  const upperSubtotal = CATEGORIES.slice(0, 6).reduce(
    (t, c) => t + value(c),
    0,
  );
  const upperBonus = upperSubtotal >= 63 ? 35 : 0;
  const upperTotal = upperSubtotal + upperBonus;
  const lowerTotal =
    CATEGORIES.slice(6).reduce((t, c) => t + value(c), 0) + vars.bonus;
  return {
    upperSubtotal,
    upperBonus,
    upperTotal,
    lowerTotal,
    grandTotal: upperTotal + lowerTotal,
  };
}

const emptyScores = () =>
  Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Record<
    Category,
    null
  >;

export const impl = {
  setup(tx) {
    tx.vars = { scores: emptyScores(), bonus: 0 };
  },
  locals: {
    freshDice: (): TurnLocals => ({
      dice: [],
      held: [false, false, false, false, false],
      rolls: 0,
    }),
  },
  steps: {
    resetScores(tx) {
      tx.vars = { scores: emptyScores(), bonus: 0 };
    },
  },
  actions: {
    roll: {
      validate: (s) =>
        s.local("turn").rolls < MAX_ROLLS ? true : "No rolls left",
      execute(tx) {
        const turn = tx.local("turn");
        turn.dice = turn.held.map((held, i) =>
          held ? turn.dice[i]! : (tx.random.roll(D6) as number),
        );
        turn.rolls++;
      },
    },
    toggleHold: {
      enumerate: (): HoldArgs[] => [0, 1, 2, 3, 4].map((index) => ({ index })),
      validate(s, args: HoldArgs) {
        const turn = s.local("turn");
        if (turn.rolls === 0) return "Roll first";
        if (turn.rolls >= MAX_ROLLS) return "No rolls left";
        if (!Number.isInteger(args.index) || args.index < 0 || args.index > 4)
          return "No such die";
        return true;
      },
      execute(tx, args: HoldArgs) {
        const turn = tx.local("turn");
        turn.held[args.index] = !turn.held[args.index];
      },
    },
    score: {
      enumerate: (): ScoreArgs[] =>
        CATEGORIES.map((category) => ({ category })),
      validate(s, args: ScoreArgs) {
        if (s.local("turn").rolls === 0) return "Roll first";
        if (!CATEGORIES.includes(args.category)) return "No such category";
        if (s.vars.scores[args.category] !== null) return "Already scored";
        return true;
      },
      execute(tx, args: ScoreArgs) {
        const dice = tx.local("turn").dice;
        // An extra Roll Five earns a bonus once the Roll Five box holds 50
        if (hasNOfAKind(dice, 5) && tx.vars.scores.rollFive === 50) {
          tx.vars.bonus += ROLL_FIVE_BONUS;
        }
        tx.vars.scores[args.category] = scoreFor(args.category, dice);
      },
    },
  },
} satisfies GameImpl<Types>;
