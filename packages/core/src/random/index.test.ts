import { describe, expect, it } from "vitest";
import { createRng, randomSeed, unseededRng } from "./index.js";

const take = <T>(n: number, next: () => T): T[] =>
  Array.from({ length: n }, () => next());

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(take(20, () => a.next())).toEqual(take(20, () => b.next()));
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(take(5, () => a.next())).not.toEqual(take(5, () => b.next()));
  });

  it("matches the reference mulberry32 output", () => {
    // Pins the algorithm: a change here breaks every recorded seed and log
    const rng = createRng(1);
    expect(take(3, () => rng.next())).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it("resumes the same sequence from a saved state", () => {
    const original = createRng(7);
    take(10, () => original.next());
    const resumed = createRng(original.state);
    expect(take(10, () => resumed.next())).toEqual(
      take(10, () => original.next()),
    );
  });

  it("returns floats in [0, 1)", () => {
    const rng = createRng(3);
    for (const value of take(1000, () => rng.next())) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("int", () => {
  it("returns integers in [0, max)", () => {
    const rng = createRng(5);
    const values = take(1000, () => rng.int(6));
    expect(values.every((v) => Number.isInteger(v) && v >= 0 && v < 6)).toBe(
      true,
    );
    expect(new Set(values).size).toBe(6);
  });

  it("rejects a non-positive or fractional max", () => {
    const rng = createRng(5);
    expect(() => rng.int(0)).toThrow(/positive integer/);
    expect(() => rng.int(2.5)).toThrow(/positive integer/);
  });
});

describe("pick", () => {
  it("returns an element of the array", () => {
    const rng = createRng(9);
    const items = ["a", "b", "c"];
    expect(
      take(50, () => rng.pick(items)).every((v) => items.includes(v)),
    ).toBe(true);
  });

  it("throws on an empty array", () => {
    expect(() => createRng(9).pick([])).toThrow(/empty/);
  });
});

describe("randomSeed and unseededRng", () => {
  it("returns uint32 seeds", () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(4294967296);
  });

  it("provides the Rng interface", () => {
    expect(unseededRng.int(3)).toBeLessThan(3);
    expect(["x"]).toContain(unseededRng.pick(["x"]));
  });
});
