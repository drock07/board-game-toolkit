import type { Rng } from "../random/index.js";

export interface Die<T = number> {
  readonly values: T[];
}

type DieResult<TDie extends Die<any>> = TDie["values"][number];

/*
 * Standard Dice
 */

export const D4 = {
  values: [1, 2, 3, 4],
} as const satisfies Die<number>;
export type D4Result = DieResult<typeof D4>;

export const D6 = {
  values: [1, 2, 3, 4, 5, 6],
} as const satisfies Die<number>;
export type D6Result = DieResult<typeof D6>;

export const D8 = {
  values: [1, 2, 3, 4, 5, 6, 7, 8],
} as const satisfies Die<number>;
export type D8Result = DieResult<typeof D8>;

export const D10 = {
  values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
} as const satisfies Die<number>;
export type D10Result = DieResult<typeof D10>;

export const D12 = {
  values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
} as const satisfies Die<number>;
export type D12Result = DieResult<typeof D12>;

export const D20 = {
  // prettier-ignore
  values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
} as const satisfies Die<number>;
export type D20Result = DieResult<typeof D20>;

// D100 uses a generated array; result type is `number`
export const D100: Die<number> = {
  values: Array.from({ length: 100 }, (_, i) => i + 1),
};
export type D100Result = DieResult<typeof D100>;

/*
 * Special Dice
 */

// Fudge/FATE die: two faces each of -1, 0, +1
export const FudgeDie = {
  values: [-1, -1, 0, 0, 1, 1],
} as const satisfies Die<number>;
export type FudgeResult = DieResult<typeof FudgeDie>;

/*
 * Helper functions
 */

function rollOne<T>(die: Die<T>, rng: Rng): T {
  return rng.pick(die.values);
}

/** Rolls a die once, or `amount` times. */
export function roll<T>(die: Die<T>, rng: Rng): T;
export function roll<T>(die: Die<T>, amount: number, rng: Rng): T[];
export function roll<T>(
  die: Die<T>,
  amountOrRng: number | Rng,
  maybeRng?: Rng,
): T | T[] {
  if (typeof amountOrRng !== "number") {
    return rollOne(die, amountOrRng);
  }
  const rng = maybeRng!;
  return Array.from({ length: amountOrRng }, () => rollOne(die, rng));
}

/** Rolls a die `amount` times and adds up the results. */
export function sum(die: Die<number>, amount: number, rng: Rng): number {
  return roll(die, amount, rng).reduce((acc, val) => acc + val, 0);
}

/** Rolls twice and keeps the higher result. */
export function withAdvantage<TDie extends Die<number>>(
  die: TDie,
  rng: Rng,
): DieResult<TDie> {
  return Math.max(rollOne(die, rng), rollOne(die, rng));
}

/** Rolls twice and keeps the lower result. */
export function withDisadvantage<TDie extends Die<number>>(
  die: TDie,
  rng: Rng,
): DieResult<TDie> {
  return Math.min(rollOne(die, rng), rollOne(die, rng));
}

/** Rolls `rolls` times and keeps the `keep` highest results, highest first. */
export function keepHighest<TDie extends Die<number>>(
  die: TDie,
  rolls: number,
  keep: number,
  rng: Rng,
): DieResult<TDie>[] {
  return roll(die, rolls, rng)
    .sort((a, b) => b - a)
    .slice(0, keep);
}

/** Rolls `rolls` times and keeps the `keep` lowest results, lowest first. */
export function keepLowest<TDie extends Die<number>>(
  die: TDie,
  rolls: number,
  keep: number,
  rng: Rng,
): DieResult<TDie>[] {
  return roll(die, rolls, rng)
    .sort((a, b) => a - b)
    .slice(0, keep);
}
