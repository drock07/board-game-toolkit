/**
 * Sources of randomness.
 *
 * Every helper in this toolkit that needs randomness takes an `Rng` argument
 * instead of calling `Math.random()`, so games can be seeded and replayed.
 * Inside the state machine, use the `rng` from the hook context. Outside it,
 * use `createRng(seed)` for reproducible results or `unseededRng` when
 * reproducibility doesn't matter (scripts, visual effects).
 */

/** A source of uniformly distributed random numbers. */
export interface Rng {
  /** Returns a float in `[0, 1)`. */
  next(): number;
  /** Returns an integer in `[0, max)`. */
  int(max: number): number;
  /** Returns a random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
}

/** A seeded generator whose position can be saved and restored. */
export interface SeededRng extends Rng {
  /**
   * The generator's current internal state, a uint32. Pass it to
   * `createRng` to continue the same sequence from this point.
   */
  readonly state: number;
}

function withHelpers(next: () => number): Rng {
  const int = (max: number) => {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`rng.int: max must be a positive integer, got ${max}`);
    }
    return Math.floor(next() * max);
  };
  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error("rng.pick: array is empty");
      return items[int(items.length)];
    },
  };
}

/**
 * Creates a seeded generator (mulberry32). The same seed always produces the
 * same sequence. A generator's `state` can be passed back in to resume it.
 */
export function createRng(seed: number): SeededRng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = withHelpers(next);
  return {
    ...rng,
    get state() {
      return state;
    },
  };
}

/** Returns a random uint32, suitable as a seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * An `Rng` backed by `Math.random()`. Results can't be reproduced, so only use
 * it where that doesn't matter, e.g. visual effects or quick scripts.
 */
export const unseededRng: Rng = withHelpers(Math.random);
