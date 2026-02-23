import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";

// --- Card Types ---

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
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

export interface Card {
  suit: Suit;
  rank: Rank;
}

// --- Game State ---

export interface BlackjackState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  playerMoney: number;
  bet: number;
  playerStood: boolean;
  result: "win" | "lose" | "push" | "blackjack" | null;
}

export type BlackjackCommand =
  | { type: "placeBet"; amount: number }
  | { type: "hit" }
  | { type: "stand" };

// --- Helpers ---

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
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
];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function drawCard(deck: Card[]): [Card, Card[]] {
  const [card, ...rest] = deck;
  return [card, rest];
}

export function handTotal(hand: Card[]): number {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function cardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

export function suitSymbol(suit: Suit): string {
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

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

// --- Initial State ---

export const initialState: BlackjackState = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  playerMoney: 1000,
  bet: 0,
  playerStood: false,
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
        deck: shuffleDeck(createDeck()),
        playerHand: [],
        dealerHand: [],
        bet: 0,
        playerStood: false,
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
        let deck = [...state.deck];
        const playerHand: Card[] = [];
        const dealerHand: Card[] = [];

        let card: Card;
        [card, deck] = drawCard(deck);
        playerHand.push(card);
        [card, deck] = drawCard(deck);
        dealerHand.push(card);
        [card, deck] = drawCard(deck);
        playerHand.push(card);
        [card, deck] = drawCard(deck);
        dealerHand.push(card);

        return { ...state, deck, playerHand, dealerHand };
      },
      getNext: (state) => {
        if (handTotal(state.playerHand) === 21) return "settle";
        return "playerTurn";
      },
    },
    playerTurn: {
      onEnter: (state) => ({ ...state, playerStood: false }),
      actions: {
        hit: {
          validate: (state) => handTotal(state.playerHand) < 21,
          execute: (state) => {
            const [card, deck] = drawCard(state.deck);
            return { ...state, deck, playerHand: [...state.playerHand, card] };
          },
        },
        stand: {
          execute: (state) => ({ ...state, playerStood: true }),
        },
      },
      getNext: (state) => {
        if (state.playerStood || handTotal(state.playerHand) === 21)
          return "dealerTurn";
        if (handTotal(state.playerHand) > 21) return "settle";
        return "playerTurn";
      },
    },
    dealerTurn: {
      autoadvance: true,
      onEnter: (state) => {
        let deck = [...state.deck];
        const dealerHand = [...state.dealerHand];
        while (handTotal(dealerHand) < 17) {
          const [card, rest] = drawCard(deck);
          dealerHand.push(card);
          deck = rest;
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
