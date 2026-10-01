import type { Die } from "./rng.js";

function numbered(n: number): Die {
  return { faces: Array.from({ length: n }, (_, i) => i + 1) };
}

export const D4: Die = numbered(4);
export const D6: Die = numbered(6);
export const D8: Die = numbered(8);
export const D10: Die = numbered(10);
export const D12: Die = numbered(12);
export const D20: Die = numbered(20);
export const D100: Die = numbered(100);
/** Fate/Fudge die: two each of -1, 0 and +1. */
export const Fudge: Die = { faces: [-1, -1, 0, 0, 1, 1] };
