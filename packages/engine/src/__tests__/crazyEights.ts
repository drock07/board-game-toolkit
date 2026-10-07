// Crazy Eights. Two to five players; match the top discard by suit or
// rank, eights are wild and name a suit. Hands are secret; the discard pile
// is public. First empty hand wins.
import type { Entity, EntityId, PlayerId } from "../index.js";
import { defaultNodes, define, entity, zone } from "../index.js";

export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  /** 1 (ace) to 13 (king). */
  rank: number;
  suit: Suit;
}

export interface Vars {
  /** The suit to follow: the top discard's, or the one an eight named. */
  suit: Suit;
  winner: PlayerId | null;
}

export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const discard = zone("discard", { holds: card });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});

const { rules, action, seq, step, turns, turn } = define<Vars>({
  zones: [deck, discard, hand],
}).withNodes(defaultNodes);

const HAND_SIZE = 5;

/** Any reader or transaction: enough to look at cards. */
interface Cards {
  readonly vars: { readonly suit: Suit };
  entities(
    zone: typeof discard | ReturnType<typeof hand.of>,
  ): readonly Entity<Card>[];
  // Both zones have the same type; the union says which ones it counts
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
  count(zone: typeof deck | typeof discard): number;
}

const top = (s: Cards) => s.entities(discard)[0]!.props;
const canPlay = (s: Cards, c: Card) =>
  c.rank === 8 || c.suit === s.vars.suit || c.rank === top(s).rank;
const playable = (s: Cards, p: PlayerId) =>
  s.entities(hand.of(p)).filter((e) => canPlay(s, e.props));
/** Something to draw: the deck, or discards under the top card to reshuffle. */
const canDraw = (s: Cards) => s.count(deck) > 0 || s.count(discard) > 1;

export const crazyEights = rules({
  players: [2, 5],
  setup: (tx) => {
    tx.vars = { suit: "♠", winner: null };
    for (const suit of SUITS)
      for (let rank = 1; rank <= 13; rank++)
        tx.create(card, { rank, suit }, deck);
  },
  flow: seq(
    step((tx) => {
      tx.shuffle(deck);
      for (const p of tx.players) tx.moveTop(deck, hand.of(p), HAND_SIZE);
      tx.moveTop(deck, discard);
      tx.vars.suit = top(tx).suit;
    }),
    turns(
      { until: (s) => s.players.some((p) => s.count(hand.of(p)) === 0) },
      turn(
        {},
        action("play", {
          /** An eight is offered once per suit it could name. */
          enumerate: (s, actor) =>
            playable(s, actor).flatMap(
              (e): { card: EntityId; suit?: Suit }[] =>
                e.props.rank === 8
                  ? SUITS.map((suit) => ({ card: e.id, suit }))
                  : [{ card: e.id }],
            ),
          execute: (tx, { card: id, suit }) => {
            tx.move(id, discard);
            tx.vars.suit = suit ?? top(tx).suit;
            return "end";
          },
        }),
        action("draw", {
          validate: (s, actor) =>
            playable(s, actor).length
              ? "You have a card you can play"
              : canDraw(s)
                ? true
                : "Nothing to draw",
          execute: (tx, actor) => {
            if (tx.count(deck) === 0) {
              tx.move(
                tx
                  .entities(discard)
                  .slice(1)
                  .map((e) => e.id),
                deck,
              );
              tx.shuffle(deck);
            }
            tx.moveTop(deck, hand.of(actor));
          },
        }),
        action("pass", {
          validate: (s, actor) =>
            playable(s, actor).length || canDraw(s)
              ? "You can still play or draw"
              : true,
          execute: () => "end",
        }),
      ),
    ),
    step((tx) => {
      tx.vars.winner =
        tx.players.find((p) => tx.count(hand.of(p)) === 0) ?? null;
      tx.end({ winner: tx.vars.winner });
    }),
  ),
});
