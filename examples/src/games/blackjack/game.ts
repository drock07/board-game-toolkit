import {
  defaultNodes,
  define,
  zone,
  type Reader,
  type Tx,
} from "@drock07/board-game-toolkit-engine";
import { card, createDeck, type PlayingCard } from "../shared/cards";

export const STARTING_BANKROLL = 100;
export const RESET_BANKROLL = 1000;

export type HandResult = "win" | "lose" | "push" | "blackjack";

// #region types
export interface Vars {
  bankroll: number;
  bet: number;
  result: HandResult | null;
}

export const shoe = zone("shoe", { holds: card, visibility: "hidden" });
export const player = zone("player", { holds: card });
// The hole card is dealt face down (`faceUp: false`) and flipped later
export const dealer = zone("dealer", { holds: card });
// #endregion types

const { rules, action, loop, seq, step, prompt, turn, outcomes, branch } =
  define<Vars>({ zones: [shoe, player, dealer] }).withNodes(defaultNodes);

function cardValue(card: PlayingCard): number {
  if (card.rank === "A") return 11;
  if (card.rank === "K" || card.rank === "Q" || card.rank === "J") return 10;
  return Number(card.rank);
}

/** The best total for a hand, counting aces as 1 where 11 would bust. */
export function handTotal(hand: readonly PlayingCard[]): number {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

const isNatural = (hand: readonly PlayingCard[]) =>
  hand.length === 2 && handTotal(hand) === 21;

/** A hand's cards in the order they were dealt (zones list the top first). */
const cardsIn = (s: Reader<Vars> | Tx<Vars>, hand: typeof player) =>
  s
    .entities(hand)
    .map((e) => e.props)
    .reverse();

const totalIn = (s: Reader<Vars>, hand: typeof player) =>
  handTotal(cardsIn(s, hand));

// #region reveal
/** Turns the dealer's face-down card up, if it still is. */
function revealHoleCard(tx: Tx<Vars>) {
  for (const c of tx.entities(dealer))
    if (c.faceUp === false) tx.flip(c.id, true);
}
// #endregion reveal

// #region actions
export const placeBet = action("placeBet", {
  // Chip amounts plus all-in, not every amount (enumerate may be partial)
  enumerate: (s) =>
    [...new Set([1, 5, 10, 25, 50, 100, s.vars.bankroll])].map((amount) => ({
      amount,
    })),
  validate: (s, { amount }) =>
    Number.isInteger(amount) && amount > 0 && amount <= s.vars.bankroll
      ? true
      : `Bet a whole amount from 1 to ${s.vars.bankroll}`,
  execute(tx, { amount }) {
    tx.vars.bet = amount;
    tx.vars.bankroll -= amount;
  },
});

export const hit = action("hit", {
  validate: (s) => (totalIn(s, player) < 21 ? true : "You can't hit on 21"),
  execute: (tx) => void tx.moveTop(shoe, player),
});

export const stand = action("stand", { execute: () => "end" });

/** Answers a "Deal again" or "Play again" prompt. */
export const next = action("continue", { execute: () => {} });
// #endregion actions

// #region rules
export const blackjack = rules({
  players: 1,
  setup(tx) {
    createDeck(tx, shoe);
    tx.vars = { bankroll: STARTING_BANKROLL, bet: 0, result: null };
  },
  flow: loop(
    {},
    seq(
      // A fresh, shuffled shoe every hand
      step((tx) => {
        tx.move(
          [...tx.entities(player), ...tx.entities(dealer)].map((c) => c.id),
          shoe,
        );
        tx.shuffle(shoe);
        tx.vars.bet = 0;
        tx.vars.result = null;
      }),
      prompt({ label: "Place a bet" }, placeBet),
      // #region deal
      step((tx) => {
        tx.moveTop(shoe, player);
        tx.moveTop(shoe, dealer);
        tx.moveTop(shoe, player);
        tx.moveTop(shoe, dealer, 1, { faceUp: false });
      }),
      // #endregion deal
      // Guards are checked on entry and after every transaction: a natural
      // skips play entirely, and a bust skips the dealer's turn
      outcomes(
        {
          natural: { when: (s) => isNatural(cardsIn(s, player)) },
          bust: { when: (s) => totalIn(s, player) > 21 },
        },
        seq(
          turn(
            { label: "Hit or stand", until: (s) => totalIn(s, player) === 21 },
            hit,
            stand,
          ),
          step((tx) => {
            revealHoleCard(tx);
            while (handTotal(cardsIn(tx, dealer)) < 17)
              tx.moveTop(shoe, dealer);
          }),
        ),
      ),
      step((tx) => {
        revealHoleCard(tx);
        const mine = cardsIn(tx, player);
        const house = cardsIn(tx, dealer);
        const p = handTotal(mine);
        const d = handTotal(house);
        const bet = tx.vars.bet;

        let result: HandResult;
        let payout = 0;
        if (isNatural(mine)) {
          if (isNatural(house)) {
            result = "push";
            payout = bet;
          } else {
            result = "blackjack";
            payout = Math.floor(bet * 2.5);
          }
        } else if (p > 21) {
          result = "lose";
        } else if (d > 21 || p > d) {
          result = "win";
          payout = bet * 2;
        } else if (p === d) {
          result = "push";
          payout = bet;
        } else {
          result = "lose";
        }
        tx.vars.result = result;
        tx.vars.bankroll += payout;
      }),
      branch(
        [
          {
            when: (s) => s.vars.bankroll <= 0,
            then: seq(
              step((tx) => {
                tx.vars.bankroll = RESET_BANKROLL;
              }),
              prompt({ label: "Play again" }, next),
            ),
          },
        ],
        prompt({ label: "Deal again" }, next),
      ),
    ),
  ),
});
// #endregion rules
