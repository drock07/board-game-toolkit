import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";
import {
  type PlayingCard,
  createPlayingCardDeck,
  shuffle,
  drawOne,
} from "@drock07/board-game-toolkit-core";

// --- Game State ---

export interface BlackjackState {
  deck: PlayingCard[];
  playerHand: PlayingCard[];
  dealerHand: PlayingCard[];
  playerMoney: number;
  bet: number;
  playerAction: "hit" | "stand" | null;
  result: "win" | "lose" | "push" | "blackjack" | null;
}

export type BlackjackCommand =
  | { type: "placeBet"; amount: number }
  | { type: "hit" }
  | { type: "stand" };

// --- Blackjack-specific Helpers ---

function cardValue(card: PlayingCard): number {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

export function handTotal(hand: PlayingCard[]): number {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

// --- Initial State ---

export const initialState: BlackjackState = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  playerMoney: 1000,
  bet: 0,
  playerAction: null,
  result: null,
};

// --- State Machine Config ---

export const blackjackConfig: StateMachineConfig<
  BlackjackState,
  BlackjackCommand
> = {
  id: "blackjack",
  initial: "betting",
  states: {
    betting: {
      onEnter: (state) => ({
        ...state,
        deck: shuffle(createPlayingCardDeck()),
        playerHand: [],
        dealerHand: [],
        bet: 0,
        playerAction: null,
        result: null,
      }),
      actions: {
        placeBet: {
          validate: (state, cmd) =>
            cmd.amount > 0 && cmd.amount <= state.playerMoney,
          execute: (state, cmd) => ({
            ...state,
            bet: cmd.amount,
            playerMoney: state.playerMoney - cmd.amount,
          }),
        },
      },
      getNext: () => "dealing",
    },
    dealing: {
      autoadvance: true,
      onEnter: (state) => {
        let deck = state.deck;
        const playerHand: PlayingCard[] = [];
        const dealerHand: PlayingCard[] = [];

        let card: PlayingCard;
        [card, deck] = drawOne(deck);
        playerHand.push(card);
        [card, deck] = drawOne(deck);
        dealerHand.push(card);
        [card, deck] = drawOne(deck);
        playerHand.push(card);
        [card, deck] = drawOne(deck);
        dealerHand.push(card);

        return { ...state, deck, playerHand, dealerHand };
      },
      getNext: (state) => {
        if (handTotal(state.playerHand) === 21) return "settle";
        return "playerTurn";
      },
    },
    playerTurn: {
      onEnter: (state) => ({ ...state, playerAction: null }),
      actions: {
        hit: {
          validate: (state) => handTotal(state.playerHand) < 21,
          execute: (state) => {
            const [card, deck] = drawOne(state.deck);
            return {
              ...state,
              deck,
              playerHand: [...state.playerHand, card],
              playerAction: "hit",
            };
          },
        },
        stand: {
          execute: (state) => ({ ...state, playerAction: "stand" }),
        },
      },
      getNext: (state) => {
        if (state.playerAction === "stand" || handTotal(state.playerHand) === 21)
          return "dealerTurn";
        if (handTotal(state.playerHand) > 21) return "settle";
        return "playerTurn";
      },
    },
    dealerTurn: {
      autoadvance: true,
      onEnter: (state) => {
        let deck = state.deck;
        const dealerHand = [...state.dealerHand];
        while (handTotal(dealerHand) < 17) {
          let card: PlayingCard;
          [card, deck] = drawOne(deck);
          dealerHand.push(card);
        }
        return { ...state, deck, dealerHand };
      },
      getNext: () => "settle",
    },
    settle: {
      onEnter: (state) => {
        const playerTotal = handTotal(state.playerHand);
        const dealerTotal = handTotal(state.dealerHand);

        let result: BlackjackState["result"];
        let payout = 0;

        if (playerTotal === 21 && state.playerHand.length === 2) {
          if (dealerTotal === 21 && state.dealerHand.length === 2) {
            result = "push";
            payout = state.bet;
          } else {
            result = "blackjack";
            payout = Math.floor(state.bet * 2.5);
          }
        } else if (playerTotal > 21) {
          result = "lose";
        } else if (dealerTotal > 21) {
          result = "win";
          payout = state.bet * 2;
        } else if (playerTotal > dealerTotal) {
          result = "win";
          payout = state.bet * 2;
        } else if (playerTotal === dealerTotal) {
          result = "push";
          payout = state.bet;
        } else {
          result = "lose";
        }

        return { ...state, result, playerMoney: state.playerMoney + payout };
      },
      getNext: (state) => (state.playerMoney > 0 ? "betting" : "gameOver"),
    },
    gameOver: {
      onEnter: (state) => ({ ...state, playerMoney: 1000 }),
      getNext: () => "betting",
    },
  },
};
