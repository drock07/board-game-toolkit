/**
 * Generic deck/collection utilities.
 *
 * These operate on any array and are useful for playing cards,
 * event decks, tile bags, or any "draw from a collection" mechanic.
 */

/** Returns a new array with items in random order (Fisher-Yates). */
export function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
/** Draws a single item from the front of the array. Returns `[item, remaining]`. */
export function draw<T>(items: T[]): [T, T[]];
/** Draws `count` items from the front of the array. Returns `[drawn, remaining]`. */
export function draw<T>(items: T[], count: number): [T[], T[]];
export function draw<T>(items: T[], count?: number): [T, T[]] | [T[], T[]] {
  if (items.length === 0) {
    throw new Error("Cannot draw from an empty collection");
  }

  if (count === undefined) {
    return [items[0], items.slice(1)];
  }

  if (count > items.length) {
    throw new Error(
      `Cannot draw ${count} items from collection of ${items.length}`,
    );
  }
  return [items.slice(0, count), items.slice(count)];
}
