import type {
  GameImpl,
  Json,
  StateReader,
  Tx,
} from "@drock07/board-game-toolkit-engine";
import {
  cardsIn,
  createDeck,
  txCardsIn,
  type PlayingCard,
} from "../shared/cards";

export const STARTING_BANKROLL = 100;
export const RESET_BANKROLL = 1000;

export type HandResult = "win" | "lose" | "push" | "blackjack";

export type Vars = {
  bankroll: number;
  bet: number;
  result: HandResult | null;
};

export type BetArgs = { amount: number };

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

function totalIn<V extends Json>(s: StateReader<V>, zone: string) {
  return handTotal(cardsIn(s, zone));
}

export const impl = {
  setup(tx) {
    createDeck(tx, "shoe");
    tx.vars = { bankroll: STARTING_BANKROLL, bet: 0, result: null };
  },
  conditions: {
    playerAt21: (s) => totalIn(s, "player") === 21,
    playerHasBlackjack: (s) => isNatural(cardsIn(s, "player")),
    playerBust: (s) => totalIn(s, "player") > 21,
    broke: (s) => s.vars.bankroll <= 0,
  },
  steps: {
    newShoe(tx) {
      const s = tx.state.zones;
      tx.move([...s.player!.items, ...s.dealer!.items], "shoe");
      tx.shuffle("shoe");
      tx.vars.bet = 0;
      tx.vars.result = null;
    },
    dealInitial(tx) {
      tx.moveTop("shoe", "player", 1, { at: "bottom" });
      tx.moveTop("shoe", "dealer", 1, { at: "bottom" });
      tx.moveTop("shoe", "player", 1, { at: "bottom" });
      tx.moveTop("shoe", "dealer", 1, { at: "bottom", faceUp: false });
    },
    dealerDraws(tx) {
      revealHoleCard(tx);
      while (handTotal(txCardsIn(tx, "dealer")) < 17) {
        tx.moveTop("shoe", "dealer", 1, { at: "bottom" });
      }
    },
    settle(tx) {
      revealHoleCard(tx);
      const player = txCardsIn(tx, "player");
      const dealer = txCardsIn(tx, "dealer");
      const p = handTotal(player);
      const d = handTotal(dealer);
      const bet = tx.vars.bet;

      let result: HandResult;
      let payout = 0;
      if (isNatural(player)) {
        if (isNatural(dealer)) {
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
    },
    resetBankroll(tx) {
      tx.vars.bankroll = RESET_BANKROLL;
    },
  },
  actions: {
    placeBet: {
      validate: (s, args: BetArgs) =>
        Number.isInteger(args.amount) &&
        args.amount > 0 &&
        args.amount <= s.vars.bankroll
          ? true
          : `Bet a whole amount from 1 to ${s.vars.bankroll}`,
      execute(tx, args: BetArgs) {
        tx.vars.bet = args.amount;
        tx.vars.bankroll -= args.amount;
      },
    },
    hit: {
      validate: (s) =>
        totalIn(s, "player") < 21 ? true : "You can't hit on 21",
      execute: (tx) => void tx.moveTop("shoe", "player", 1, { at: "bottom" }),
    },
    stand: { execute: () => {} },
  },
} satisfies GameImpl<Vars>;

/** Turns the dealer's face-down card up, if it still is. */
function revealHoleCard(tx: Tx<Vars>) {
  for (const id of tx.state.zones.dealer!.items) {
    if (tx.state.entities[id]!.faceUp === false) tx.flip(id, true);
  }
}
