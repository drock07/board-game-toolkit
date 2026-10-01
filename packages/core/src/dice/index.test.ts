import { describe, expect, it } from "vitest";
import { createRng } from "../random/index.js";
import {
  D20,
  D6,
  FudgeDie,
  keepHighest,
  keepLowest,
  roll,
  sum,
  withAdvantage,
  withDisadvantage,
} from "./index.js";

describe("roll", () => {
  it("is reproducible with the same seed", () => {
    expect(roll(D6, 10, createRng(1))).toEqual(roll(D6, 10, createRng(1)));
  });

  it("rolls once without an amount", () => {
    const value = roll(D20, createRng(1));
    expect(D20.values).toContain(value);
  });

  it("returns values from the die", () => {
    const values = roll(FudgeDie, 50, createRng(2));
    expect(values).toHaveLength(50);
    expect(
      values.every((v) => (FudgeDie.values as readonly number[]).includes(v)),
    ).toBe(true);
  });

  it("produces every face over many rolls", () => {
    expect(new Set(roll(D6, 200, createRng(3)))).toEqual(
      new Set([1, 2, 3, 4, 5, 6]),
    );
  });
});

describe("sum", () => {
  it("adds the same rolls that roll() produces", () => {
    const rolls = roll(D6, 4, createRng(4));
    expect(sum(D6, 4, createRng(4))).toBe(rolls.reduce((a, b) => a + b, 0));
  });
});

describe("withAdvantage / withDisadvantage", () => {
  it("keep the higher / lower of two rolls", () => {
    const [a, b] = roll(D20, 2, createRng(5));
    expect(withAdvantage(D20, createRng(5))).toBe(Math.max(a, b));
    expect(withDisadvantage(D20, createRng(5))).toBe(Math.min(a, b));
  });
});

describe("keepHighest / keepLowest", () => {
  it("keep the highest results, highest first", () => {
    const rolls = roll(D6, 5, createRng(6));
    const expected = [...rolls].sort((x, y) => y - x).slice(0, 3);
    expect(keepHighest(D6, 5, 3, createRng(6))).toEqual(expected);
  });

  it("keep the lowest results, lowest first", () => {
    const rolls = roll(D6, 5, createRng(6));
    const expected = [...rolls].sort((x, y) => x - y).slice(0, 2);
    expect(keepLowest(D6, 5, 2, createRng(6))).toEqual(expected);
  });
});
