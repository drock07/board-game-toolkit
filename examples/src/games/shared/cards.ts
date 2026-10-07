import {
  entity,
  type Tx,
  type ZoneRef,
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

/**
 * The playing-card entity type. Games share this one handle: a game may
 * have only one entity type named "card".
 */
export const card = entity<PlayingCard>("card");

/** Creates a standard 52-card deck in `zone`, in suit then rank order. */
export function createDeck<V>(tx: Tx<V>, zone: ZoneRef<PlayingCard>): void {
  for (const suit of SUITS)
    for (const rank of RANKS) tx.create(card, { suit, rank }, zone);
}
