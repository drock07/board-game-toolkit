import { describe, expect, it } from "vitest";
import { draw, shuffle } from "./deck";

describe("shuffle", () => {
  it("returns a new array with the same elements", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items);
    expect(result).toHaveLength(items.length);
    expect(result.sort()).toEqual(items.sort());
  });

  it("does not mutate the original array", () => {
    const items = [1, 2, 3];
    const copy = [...items];
    shuffle(items);
    expect(items).toEqual(copy);
  });
});

describe("draw", () => {
  describe("single-item signatures (no count)", () => {
    it("draws a single item from the front", () => {
      const [item, remaining] = draw([1, 2, 3]);
      expect(item).toBe(1);
      expect(remaining).toEqual([2, 3]);
    });

    it("draws a single item with reshuffleFrom", () => {
      const [item, remaining, discard] = draw([1, 2, 3], [4, 5]);
      expect(item).toBe(1);
      expect(remaining).toEqual([2, 3]);
      expect(discard).toEqual([4, 5]);
    });
  });

  describe("multi-item signatures (with count)", () => {
    it("draws multiple items as an array", () => {
      const [drawn, remaining] = draw([1, 2, 3, 4], 2);
      expect(drawn).toEqual([1, 2]);
      expect(remaining).toEqual([3, 4]);
    });

    it("draws count=1 and returns an array, not a single item", () => {
      const [drawn, remaining] = draw([1, 2, 3], 1);
      expect(Array.isArray(drawn)).toBe(true);
      expect(drawn).toEqual([1]);
      expect(remaining).toEqual([2, 3]);
    });

    it("draws multiple items with reshuffleFrom", () => {
      const [drawn, remaining, discard] = draw([1, 2, 3, 4], 2, [5, 6]);
      expect(drawn).toEqual([1, 2]);
      expect(remaining).toEqual([3, 4]);
      expect(discard).toEqual([5, 6]);
    });

    it("draws count=1 with reshuffleFrom and returns an array", () => {
      const [drawn, remaining, discard] = draw([1, 2, 3], 1, [4, 5]);
      expect(Array.isArray(drawn)).toBe(true);
      expect(drawn).toEqual([1]);
      expect(remaining).toEqual([2, 3]);
      expect(discard).toEqual([4, 5]);
    });
  });

  describe("error cases", () => {
    it("throws when drawing from an empty collection", () => {
      expect(() => draw([])).toThrow("Cannot draw from an empty collection");
    });

    it("throws when drawing more items than available", () => {
      expect(() => draw([1, 2], 5)).toThrow(
        "Cannot draw 5 items from collection of 2",
      );
    });
  });

  describe("reshuffle behavior", () => {
    it("reshuffles discard pile when deck is too small", () => {
      const [drawn, , discard] = draw([1], 2, [2, 3, 4]);
      expect(drawn).toHaveLength(2);
      expect(drawn[0]).toBe(1);
      expect(discard).toEqual([]);
    });

    it("returns discard pile unchanged when no reshuffle is needed", () => {
      const [drawn, remaining, discard] = draw([1, 2, 3], 2, [4, 5]);
      expect(drawn).toEqual([1, 2]);
      expect(remaining).toEqual([3]);
      expect(discard).toEqual([4, 5]);
    });

    it("returns discard pile unchanged for single draw when no reshuffle is needed", () => {
      const [item, remaining, discard] = draw([1, 2], [3, 4]);
      expect(item).toBe(1);
      expect(remaining).toEqual([2]);
      expect(discard).toEqual([3, 4]);
    });

    it("empties discard pile for single draw when reshuffle occurs", () => {
      const [item, remaining, discard] = draw([], [1, 2, 3]);
      expect([1, 2, 3]).toContain(item);
      expect(remaining).toHaveLength(2);
      expect(discard).toEqual([]);
    });
  });
});
