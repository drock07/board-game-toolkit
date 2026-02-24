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

/** Draws `count` items from the front of the array. Returns `[drawn, remaining]`. */
export function draw<T>(items: T[], count: number): [T[], T[]] {
  if (count > items.length) {
    throw new Error(
      `Cannot draw ${count} items from collection of ${items.length}`,
    );
  }
  return [items.slice(0, count), items.slice(count)];
}

/** Draws a single item from the front of the array. Returns `[item, remaining]`. */
export function drawOne<T>(items: T[]): [T, T[]] {
  const [drawn, remaining] = draw(items, 1);
  return [drawn[0], remaining];
}
