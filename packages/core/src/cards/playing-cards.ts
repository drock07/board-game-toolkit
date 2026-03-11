/**
 * Standard 52-card playing card types and helpers.
 */

/** One of the four standard playing card suits. */
export type PlayingCardSuit = "hearts" | "diamonds" | "clubs" | "spades";

/** Standard playing card ranks, Ace through King. */
export type PlayingCardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

/** A standard playing card with a suit and rank. */
export interface PlayingCard {
  suit: PlayingCardSuit;
  rank: PlayingCardRank;
}

/** All four suits in standard order: hearts, diamonds, clubs, spades. */
export const PLAYING_CARD_SUITS: readonly PlayingCardSuit[] = [
  "hearts",
  "diamonds",
  "clubs",
  "spades",
] as const;

/** All thirteen ranks in standard order: A, 2–10, J, Q, K. */
export const PLAYING_CARD_RANKS: readonly PlayingCardRank[] = [
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

/** Creates a standard 52-card deck (unshuffled). Use {@link shuffle} to randomize. */
export function createPlayingCardDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of PLAYING_CARD_SUITS) {
    for (const rank of PLAYING_CARD_RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Returns the Unicode symbol for a suit: ♥ ♦ ♣ ♠. */
export function playingCardSuitSymbol(suit: PlayingCardSuit): string {
  switch (suit) {
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
    case "spades":
      return "♠";
  }
}

/** Returns `true` if the suit is hearts or diamonds. */
export function isPlayingCardRedSuit(suit: PlayingCardSuit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

/** Returns `true` if the suit is clubs or spades. */
export function isPlayingCardBlackSuit(suit: PlayingCardSuit): boolean {
  return suit === "clubs" || suit === "spades";
}
