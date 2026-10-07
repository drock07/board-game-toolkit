import type { Json } from "./json.js";

/**
 * The generator is sfc32 (Chris Doty-Humphrey's Small Fast Chaotic PRNG, 32-bit
 * variant), whose 128-bit state is four uint32s. String seeds are hashed into
 * that state with cyrb128, then the generator is warmed up for 12 rounds so
 * similar seeds diverge.
 */
export type RngState = [number, number, number, number];

/** cyrb128: hashes a string into four uint32s. */
export function cyrb128(str: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Advances `s` in place and returns the next uint32. */
export function sfc32Next(s: RngState): number {
  let [a, b, c, d] = s;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  s[0] = a >>> 0;
  s[1] = b >>> 0;
  s[2] = c >>> 0;
  s[3] = d >>> 0;
  return t >>> 0;
}

export function seedRng(seed: string): RngState {
  const s = cyrb128(seed);
  for (let i = 0; i < 12; i++) sfc32Next(s);
  return s;
}

/** A die is its list of faces; rolling picks one uniformly. */
export interface Die<F extends Json = Json> {
  readonly faces: readonly F[];
}

export interface Random {
  /** Uniform integer in `[0, maxExclusive)`. */
  int(maxExclusive: number): number;
  /** Uniform float in `[0, 1)`. */
  float(): number;
  /** A uniformly chosen element. Throws on an empty array. */
  pick<T>(array: readonly T[]): T;
  /** A shuffled copy (Fisher–Yates). The input is not changed. */
  shuffle<T>(array: readonly T[]): T[];
  /** A uniformly chosen face. */
  roll<F extends Json>(die: { faces: readonly F[] }): F;
}

/**
 * Builds a `Random` over a mutable state holder. `state()` is read on every
 * draw, so the holder can be a transaction draft.
 */
export function createRandom(state: () => RngState): Random {
  const float = () => sfc32Next(state()) / 4294967296;
  const int = (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(
        `random.int: max must be a positive integer, got ${maxExclusive}`,
      );
    }
    return Math.floor(float() * maxExclusive);
  };
  const pick = <T>(array: readonly T[]): T => {
    if (array.length === 0) throw new RangeError("random.pick: empty array");
    return array[int(array.length)]!;
  };
  return {
    int,
    float,
    pick,
    shuffle<T>(array: readonly T[]): T[] {
      const out = array.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    roll: (die) => pick(die.faces),
  };
}

/** A standalone seeded `Random`, for bots, tests and tools outside a game. */
export function seededRandom(seed: string): Random {
  const s = seedRng(seed);
  return createRandom(() => s);
}
