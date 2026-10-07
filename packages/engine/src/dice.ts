import type { Die } from "./rng.js";

function numbered(n: number): Die<number> {
  return { faces: Array.from({ length: n }, (_, i) => i + 1) };
}

export const D4 = numbered(4);
export const D6 = numbered(6);
export const D8 = numbered(8);
export const D10 = numbered(10);
export const D12 = numbered(12);
export const D20 = numbered(20);
export const D100 = numbered(100);
/** Fate/Fudge die: two each of -1, 0 and +1. */
export const Fudge: Die<-1 | 0 | 1> = { faces: [-1, -1, 0, 0, 1, 1] };
