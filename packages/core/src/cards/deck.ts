/**
 * Generic deck/collection utilities.
 *
 * These operate on any array and are useful for playing cards,
 * event decks, tile bags, or any "draw from a collection" mechanic.
 */

import type { Rng } from "../random/index.js";

/** Returns a new array with items in random order (Fisher-Yates). */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
/**
 * Draws items from the front of an array.
 *
 * When called without a count, draws a single item and returns `[item, remaining]`.
 * When called with a count, draws multiple items and returns `[items[], remaining]`.
 *
 * Optionally accepts a `reshuffleFrom` array and an `rng` — if the draw array
 * doesn't have enough items, the reshuffle array is shuffled back in
 * automatically. When a reshuffle source is provided, the return tuple
 * includes the (potentially emptied) reshuffle array as a third element.
 *
 * @throws If the collection is empty.
 * @throws If there are not enough items to draw.
 */
export function draw<T>(items: T[]): [T, T[]];
export function draw<T>(
  items: T[],
  reshuffleFrom: T[],
  rng: Rng,
): [T, T[], T[]];
export function draw<T>(items: T[], count: number): [T[], T[]];
export function draw<T>(
  items: T[],
  count: number,
  reshuffleFrom: T[],
  rng: Rng,
): [T[], T[], T[]];
export function draw<T>(
  items: T[],
  countOrReshuffleFrom?: number | T[],
  reshuffleFromOrRng?: T[] | Rng,
  maybeRng?: Rng,
): [T, T[]] | [T, T[], T[]] | [T[], T[]] | [T[], T[], T[]] {
  const count =
    typeof countOrReshuffleFrom === "number" ? countOrReshuffleFrom : 1;
  const reshuffleDeck = Array.isArray(countOrReshuffleFrom)
    ? countOrReshuffleFrom
    : Array.isArray(reshuffleFromOrRng)
      ? reshuffleFromOrRng
      : undefined;
  const rng = Array.isArray(reshuffleFromOrRng) ? maybeRng : reshuffleFromOrRng;

  let drawDeck = items;
  let reshuffled = false;
  if (reshuffleDeck && drawDeck.length < count) {
    if (!rng) throw new Error("draw: reshuffling requires an rng");
    drawDeck = [...items, ...shuffle(reshuffleDeck, rng)];
    reshuffled = true;
  }

  if (drawDeck.length === 0) {
    throw new Error("Cannot draw from an empty collection");
  }

  if (count > drawDeck.length) {
    throw new Error(
      `Cannot draw ${count} items from collection of ${drawDeck.length}`,
    );
  }

  if (count === 1 && typeof countOrReshuffleFrom !== "number") {
    if (reshuffleDeck)
      return [drawDeck[0], drawDeck.slice(1), reshuffled ? [] : reshuffleDeck];
    return [drawDeck[0], drawDeck.slice(1)];
  }

  if (reshuffleDeck) {
    return [
      drawDeck.slice(0, count),
      drawDeck.slice(count),
      reshuffled ? [] : reshuffleDeck,
    ];
  }

  return [drawDeck.slice(0, count), drawDeck.slice(count)];
}
