// Roll Five (Yahtzee). Five dice, up to three rolls a turn holding any you
// like, then score one of thirteen categories. Thirteen rounds.
import type { PlayerId } from "../index.js";
import { defaultNodes, define, entity, zone, type Reader } from "../index.js";
import { turnNode } from "./turn.js";

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
export const UPPER_BONUS = 35;
export const UPPER_BONUS_AT = 63;

export interface Die {
  value: number;
  held: boolean;
}

export interface Vars {
  /** Points per category; null until scored. */
  scores: Record<PlayerId, Record<Category, number | null>>;
  /** Bonus points for extra Roll Fives. */
  bonus: Record<PlayerId, number>;
}

export const die = entity<Die>("die");
export const dice = zone("dice", { holds: die });

const { rules, action, seq, step, turns, turn } = define<Vars>({
  zones: [dice],
}).withNodes([...defaultNodes, turnNode]);

function counts(values: readonly number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const v of values) out[v]!++;
  return out;
}
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const hasNOfAKind = (values: readonly number[], n: number) =>
  counts(values).some((c) => c >= n);
function longestRun(values: readonly number[]): number {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  unique.forEach((d, i) => {
    run = i > 0 && d === unique[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}
export const isRollFive = (values: readonly number[]) => hasNOfAKind(values, 5);

/** What the dice would score in a category. */
export function scoreFor(
  category: Category,
  values: readonly number[],
): number {
  const c = counts(values);
  const upper = CATEGORIES.indexOf(category);
  if (upper < 6) return c[upper + 1]! * (upper + 1);
  switch (category) {
    case "threeOfAKind":
      return hasNOfAKind(values, 3) ? sum(values) : 0;
    case "fourOfAKind":
      return hasNOfAKind(values, 4) ? sum(values) : 0;
    case "fullHouse":
      return c.includes(3) && c.includes(2) ? 25 : 0;
    case "smallStraight":
      return longestRun(values) >= 4 ? 30 : 0;
    case "largeStraight":
      return longestRun(values) >= 5 ? 40 : 0;
    case "rollFive":
      return isRollFive(values) ? 50 : 0;
    case "chance":
      return sum(values);
  }
  return 0;
}

const values = (s: Pick<Reader<Vars>, "entities">) =>
  s.entities(dice).map((d) => d.props.value);

/** A player's total: categories, the upper bonus, and extra Roll Fives. */
export function total(
  sheet: Record<Category, number | null>,
  bonus: number,
): number {
  const upper = CATEGORIES.slice(0, 6).reduce((n, c) => n + (sheet[c] ?? 0), 0);
  const all = CATEGORIES.reduce((n, c) => n + (sheet[c] ?? 0), 0);
  return all + (upper >= UPPER_BONUS_AT ? UPPER_BONUS : 0) + bonus;
}

export const rollFive = rules({
  players: [1, 4],
  setup: (tx) => {
    const sheet = () =>
      Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Record<
        Category,
        number | null
      >;
    tx.vars = {
      scores: Object.fromEntries(tx.players.map((p) => [p, sheet()])),
      bonus: Object.fromEntries(tx.players.map((p) => [p, 0])),
    };
    for (let i = 0; i < 5; i++) tx.create(die, { value: 1, held: false }, dice);
  },
  flow: seq(
    turns(
      { rounds: CATEGORIES.length },
      turn(
        { limits: { roll: MAX_ROLLS }, first: ["roll"] },
        action("roll", {
          execute: (tx) => {
            for (const d of tx.entities(dice))
              if (!d.props.held) tx.update(d, { value: tx.random.int(1, 6) });
          },
        }),
        action("hold", {
          enumerate: (s) => s.entities(dice).map((d) => ({ die: d.id })),
          execute: (tx, { die: id }) => {
            const d = tx.entity(id);
            if (die.is(d)) tx.update(d, { held: !d.props.held });
          },
        }),
        action("score", {
          enumerate: (s, actor) =>
            CATEGORIES.filter((c) => s.vars.scores[actor]![c] === null).map(
              (category) => ({ category }),
            ),
          execute: (tx, { category }, actor) => {
            const v = values(tx);
            const sheet = tx.vars.scores[actor]!;
            if (isRollFive(v) && sheet.rollFive)
              tx.vars.bonus[actor]! += ROLL_FIVE_BONUS;
            sheet[category] = scoreFor(category, v);
            for (const d of tx.entities(dice)) tx.update(d, { held: false });
            return "end";
          },
        }),
      ),
    ),
    step((tx) => {
      const totals = Object.fromEntries(
        tx.players.map((p) => [
          p,
          total(tx.vars.scores[p]!, tx.vars.bonus[p]!),
        ]),
      );
      tx.end({ totals });
    }),
  ),
});
