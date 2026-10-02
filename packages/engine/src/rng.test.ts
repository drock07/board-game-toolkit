import { describe, expect, test } from "vitest";
import { D100, D20, D4, D6, Fudge } from "./dice.js";
import { cyrb128, seededRandom, seedRng, sfc32Next } from "./rng.js";

describe("rng golden values", () => {
  // These pin the algorithm: changing them breaks every saved game and replay
  test("cyrb128 and seeding", () => {
    expect(cyrb128("s1")).toEqual([
      3747928884, 3059849859, 2520894988, 462701932,
    ]);
    expect(seedRng("s1")).toEqual([
      535373314, 845678323, 3748538105, 462701944,
    ]);
  });

  test("sfc32 output", () => {
    const s = seedRng("s1");
    expect([0, 1, 2, 3, 4].map(() => sfc32Next(s))).toEqual([
      1843753582, 686085931, 2893207723, 2058228605, 2527657707,
    ]);
  });

  test("Random helpers", () => {
    const r = seededRandom("golden");
    expect(r.int(6)).toBe(3);
    expect(r.int(100)).toBe(64);
    expect(r.float()).toBe(0.6010793684981763);
    expect(r.shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([
      1, 3, 5, 2, 8, 6, 7, 4,
    ]);
  });
});

describe("Random", () => {
  test("same seed, same sequence; different seeds diverge", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    const c = seededRandom("y");
    const seqA = Array.from({ length: 20 }, () => a.int(1000));
    expect(Array.from({ length: 20 }, () => b.int(1000))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c.int(1000))).not.toEqual(seqA);
  });

  test("int stays in range and covers it", () => {
    const r = seededRandom("range");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const n = r.int(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });

  test("int rejects bad bounds; pick rejects empty arrays", () => {
    const r = seededRandom("bad");
    expect(() => r.int(0)).toThrow(RangeError);
    expect(() => r.int(1.5)).toThrow(RangeError);
    expect(() => r.pick([])).toThrow(RangeError);
  });

  test("shuffle returns a permutation and leaves the input alone", () => {
    const input = Object.freeze([1, 2, 3, 4, 5]);
    const out = seededRandom("perm").shuffle(input);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  test("roll picks a face", () => {
    const r = seededRandom("dice");
    for (let i = 0; i < 50; i++) {
      expect(D6.faces).toContain(r.roll(D6));
      expect(Fudge.faces).toContain(r.roll(Fudge));
    }
  });
});

test("standard dice", () => {
  expect(D4.faces).toEqual([1, 2, 3, 4]);
  expect(D20.faces).toHaveLength(20);
  expect(D100.faces.at(-1)).toBe(100);
  expect(Fudge.faces).toEqual([-1, -1, 0, 0, 1, 1]);
});
