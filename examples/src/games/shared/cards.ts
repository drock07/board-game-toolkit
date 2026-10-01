import type {
  Json,
  StateReader,
  Tx,
  ZoneId,
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
export type PlayingCard = { suit: Suit; rank: Rank };

/** Creates a standard 52-card deck in `zone`, in suit then rank order. */
export function createDeck<V extends Json>(tx: Tx<V>, zone: ZoneId): void {
  for (const suit of SUITS) {
    for (const rank of RANKS) tx.create("card", { suit, rank }, zone);
  }
}

/** The playing cards in a zone, top first. */
export function cardsIn<V extends Json>(
  s: StateReader<V>,
  zone: ZoneId,
): PlayingCard[] {
  return s.entities(zone).map((e) => e.props as PlayingCard);
}

/** The playing cards in a zone as a transaction sees them, top first. */
export function txCardsIn<V extends Json>(
  tx: Tx<V>,
  zone: ZoneId,
): PlayingCard[] {
  return (tx.state.zones[zone]?.items ?? []).map(
    (id) => tx.state.entities[id]!.props as PlayingCard,
  );
}
