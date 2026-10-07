import {
  D6,
  defaultNodes,
  define,
  turnNode,
} from "@drock07/board-game-toolkit-engine";

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

// #region types
// One player and five dice, so there are no zones. The turn counts its own
// rolls; the UI reads them with `turnNode.shown(view)`.
export interface Vars {
  /** Points per category; null until scored. */
  scores: Record<Category, number | null>;
  /** Bonus points for extra Roll Fives. */
  bonus: number;
  /** This turn's dice; empty until the first roll. */
  dice: number[];
  held: boolean[];
}
// #endregion types

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

export function scoreSummary(
  vars: Pick<Vars, "scores" | "bonus">,
): ScoreSummary {
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

const freshVars = (): Vars => ({
  scores: Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Record<
    Category,
    null
  >,
  bonus: 0,
  dice: [],
  held: [false, false, false, false, false],
});

const { rules, action, loop, seq, step, turns, turn, prompt } =
  define<Vars>().withNodes(defaultNodes);

// #region actions
// #region roll
export const roll = action("roll", {
  execute(tx) {
    const { dice, held } = tx.vars;
    tx.vars.dice = held.map((h, i) => (h ? dice[i]! : tx.random.roll(D6)));
  },
});
// #endregion roll

export const toggleHold = action("toggleHold", {
  enumerate: () => [0, 1, 2, 3, 4].map((index) => ({ index })),
  validate(s, { index }) {
    if (s.vars.dice.length === 0) return "Roll first";
    // The turn counts its rolls; holding after the last one changes nothing
    if ((turnNode.shown(s)?.counts.roll ?? 0) >= MAX_ROLLS)
      return "No rolls left";
    if (!Number.isInteger(index) || index < 0 || index > 4)
      return "No such die";
    return true;
  },
  execute(tx, { index }) {
    tx.vars.held[index] = !tx.vars.held[index];
  },
});

export const score = action("score", {
  enumerate: () => CATEGORIES.map((category) => ({ category })),
  validate(s, { category }) {
    if (s.vars.dice.length === 0) return "Roll first";
    if (!CATEGORIES.includes(category)) return "No such category";
    if (s.vars.scores[category] !== null) return "Already scored";
    return true;
  },
  execute(tx, { category }) {
    const { dice } = tx.vars;
    // An extra Roll Five earns a bonus once the Roll Five box holds 50
    if (hasNOfAKind(dice, 5) && tx.vars.scores.rollFive === 50) {
      tx.vars.bonus += ROLL_FIVE_BONUS;
    }
    tx.vars.scores[category] = scoreFor(category, dice);
    // The next turn starts with fresh dice
    tx.vars.dice = [];
    tx.vars.held = [false, false, false, false, false];
    return "end";
  },
});

export const again = action("again", { execute: () => {} });
// #endregion actions

// #region rules
export const rollFive = rules({
  players: 1,
  setup(tx) {
    tx.vars = freshVars();
  },
  // Games repeat forever: clear the sheet, play 13 turns, wait
  flow: loop(
    {},
    seq(
      step((tx) => {
        tx.vars = freshVars();
      }),
      turns(
        { rounds: CATEGORIES.length },
        // #region turn
        // Up to three rolls, holding dice between them, then one score
        turn(
          {
            label: "Roll or score",
            limits: { roll: MAX_ROLLS },
            first: ["roll"],
          },
          roll,
          toggleHold,
          score,
        ),
        // #endregion turn
      ),
      prompt({ label: "Play again" }, again),
    ),
  ),
});
// #endregion rules
