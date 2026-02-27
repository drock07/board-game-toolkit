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

function rollOne<T>(die: Die<T>): T {
  return die.values[Math.floor(Math.random() * die.values.length)];
}

export function roll<T>(die: Die<T>): T;
export function roll<T>(die: Die<T>, amount: number): T[];
export function roll<T>(die: Die<T>, amount?: number): T | T[] {
  if (amount === undefined) {
    return rollOne(die);
  }
  return Array.from({ length: amount }, () => rollOne(die));
}

export function sum(die: Die<number>, amount: number): number {
  return roll(die, amount).reduce((acc, val) => acc + val, 0);
}

export function withAdvantage<TDie extends Die<number>>(
  die: TDie,
): DieResult<TDie> {
  return Math.max(rollOne(die), rollOne(die)) as DieResult<TDie>;
}

export function withDisadvantage<TDie extends Die<number>>(
  die: TDie,
): DieResult<TDie> {
  return Math.min(rollOne(die), rollOne(die)) as DieResult<TDie>;
}

export function keepHighest<TDie extends Die<number>>(
  die: TDie,
  rolls: number,
  keep: number,
): DieResult<TDie>[] {
  return roll(die, rolls)
    .sort((a, b) => (b as number) - (a as number))
    .slice(0, keep) as DieResult<TDie>[];
}

export function keepLowest<TDie extends Die<number>>(
  die: TDie,
  rolls: number,
  keep: number,
): DieResult<TDie>[] {
  return roll(die, rolls)
    .sort((a, b) => (a as number) - (b as number))
    .slice(0, keep) as DieResult<TDie>[];
}
