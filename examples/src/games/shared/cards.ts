import type {
  GameTypes,
  Tx,
  ZoneIdOf,
} from "@drock07/board-game-toolkit-engine";

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export interface PlayingCard {
  suit: Suit;
  rank: Rank;
}

/** Any game whose entities include standard playing cards. */
export type WithPlayingCards = GameTypes & { entities: { card: PlayingCard } };

/** Creates a standard 52-card deck in `zone`, in suit then rank order. */
export function createDeck<T extends WithPlayingCards>(
  tx: Tx<T>,
  zone: ZoneIdOf<T>,
): void {
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      // The props are a PlayingCard; TypeScript can't see that through the generic
      tx.create("card", { suit, rank }, zone);
    }
  }
}
