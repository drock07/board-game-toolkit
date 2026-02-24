/**
 * Standard 52-card playing card types and helpers.
 */

export type PlayingCardSuit = "hearts" | "diamonds" | "clubs" | "spades";

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

export interface PlayingCard {
  suit: PlayingCardSuit;
  rank: PlayingCardRank;
}

export const PLAYING_CARD_SUITS: readonly PlayingCardSuit[] = [
  "hearts",
  "diamonds",
  "clubs",
  "spades",
] as const;

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

/** Creates a standard 52-card deck (unshuffled). */
export function createPlayingCardDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of PLAYING_CARD_SUITS) {
    for (const rank of PLAYING_CARD_RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Returns the Unicode symbol for a suit (♥♦♣♠). */
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

/** Returns true for hearts and diamonds. */
export function isPlayingCardRedSuit(suit: PlayingCardSuit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

/** Returns true for clubs and spades. */
export function isPlayingCardBlackSuit(suit: PlayingCardSuit): boolean {
  return suit === "clubs" || suit === "spades";
}
