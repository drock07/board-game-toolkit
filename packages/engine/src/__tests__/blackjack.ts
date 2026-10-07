// Blackjack. One to four players against a dealer the rules play. A hidden
// deck, public hands, and the dealer's second card face down until the end.
import type { Entity, PlayerId } from "../index.js";
import { defaultNodes, define, entity, zone } from "../index.js";
import { turnNode } from "./turn.js";

type Suit = "♠" | "♥" | "♦" | "♣";
export interface Card {
  /** 1 (ace) to 13 (king). */
  rank: number;
  suit: Suit;
}

export interface Vars {
  results: Record<PlayerId, "win" | "lose" | "push">;
}

// The box
export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const dealer = zone("dealer", { holds: card });
export const hand = zone("hand", { holds: card, perPlayer: true });

const { rules, action, seq, step, turns, turn } = define<Vars>({
  zones: [deck, dealer, hand],
}).withNodes([...defaultNodes, turnNode]);

/** Best total: aces count 11 unless that busts. */
export function total(cards: readonly Entity<Card>[]): number {
  let sum = 0;
  let aces = 0;
  for (const { props } of cards) {
    if (props.rank === 1) aces++;
    sum += Math.min(props.rank, 10);
  }
  while (aces-- > 0 && sum + 10 <= 21) sum += 10;
  return sum;
}

export const blackjack = rules({
  players: [1, 4],
  setup: (tx) => {
    tx.vars = { results: {} };
    for (const suit of ["♠", "♥", "♦", "♣"] as const) {
      for (let rank = 1; rank <= 13; rank++)
        tx.create(card, { rank, suit }, deck);
    }
  },
  flow: seq(
    step((tx) => {
      tx.shuffle(deck);
      for (const p of tx.players) tx.moveTop(deck, hand.of(p), 2);
      tx.moveTop(deck, dealer);
      tx.moveTop(deck, dealer, 1, { faceUp: false });
    }),
    turns(
      { rounds: 1 },
      turn(
        {},
        action("hit", {
          execute: (tx, actor) => {
            tx.moveTop(deck, hand.of(actor));
            if (total(tx.entities(hand.of(actor))) > 21) return "end";
          },
        }),
        action("stand", { execute: () => "end" }),
      ),
    ),
    step((tx) => {
      for (const c of tx.entities(dealer)) tx.flip(c.id, true);
      while (total(tx.entities(dealer)) < 17) tx.moveTop(deck, dealer);
      const house = total(tx.entities(dealer));
      for (const p of tx.players) {
        const mine = total(tx.entities(hand.of(p)));
        tx.vars.results[p] =
          mine > 21
            ? "lose"
            : house > 21 || mine > house
              ? "win"
              : mine < house
                ? "lose"
                : "push";
      }
      tx.end(tx.vars.results);
    }),
  ),
});
