import type {
  GenericCardGameState,
  GenericCardInstance,
  StateMachineConfig,
} from "@drock07/board-game-toolkit-core";
import { Cards } from "@drock07/board-game-toolkit-core";

// --- Card Type ---

export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type CardColor = (typeof COLORS)[number];

export interface CrazyEightsCard extends GenericCardInstance {
  color: CardColor;
  value: number; // 1–8
}

let nextCardId = 0;
function createCard(color: CardColor, value: number): CrazyEightsCard {
  return { id: `${color}-${value}-${nextCardId++}`, color, value };
}

export function createDeck(): CrazyEightsCard[] {
  const deck: CrazyEightsCard[] = [];
  for (const color of COLORS) {
    for (let value = 1; value <= 8; value++) {
      deck.push(createCard(color, value));
      deck.push(createCard(color, value)); // two of each
    }
  }
  return deck;
}

// --- Pool IDs ---

export type CrazyEightsPoolId =
  | "drawPile"
  | "discardPile"
  | "player"
  | "opponent1"
  | "opponent2";

// --- Game State ---

export interface CrazyEightsState extends GenericCardGameState<
  CrazyEightsPoolId,
  CrazyEightsCard
> {
  currentPlayer: CrazyEightsPlayer;
  activeColor: CardColor;
  selectedCardId: string | null;
  result: "win" | "lose" | null;
  message: string | null;
}

export type CrazyEightsCommand =
  | { type: "selectCard"; cardId: string }
  | { type: "playCard" }
  | { type: "drawCard" };

export type CrazyEightsPlayer = "player" | "opponent1" | "opponent2";

export type CrazyEightsEvent = {
  chooseWildColor: () => CardColor;
  aiCardPlayed: (data: {
    card: CrazyEightsCard;
    player: CrazyEightsPlayer;
  }) => void;
  aiCardDrawn: (data: { player: CrazyEightsPlayer }) => void;
};

// --- Helpers ---

function topDiscard(state: CrazyEightsState): CrazyEightsCard {
  return state.pools.discardPile[state.pools.discardPile.length - 1];
}

export function canPlayCard(
  card: CrazyEightsCard,
  activeColor: CardColor,
  topCard: CrazyEightsCard,
): boolean {
  if (card.value === 8) return true;
  return card.color === activeColor || card.value === topCard.value;
}

function getPlayableCards(
  hand: CrazyEightsCard[],
  activeColor: CardColor,
  topCard: CrazyEightsCard,
): CrazyEightsCard[] {
  return hand.filter((c) => canPlayCard(c, activeColor, topCard));
}

function playCardToDiscard(
  state: CrazyEightsState,
  poolId: CrazyEightsPoolId,
  cardId: string,
): CrazyEightsState {
  const card = state.pools[poolId].find((c) => c.id === cardId)!;
  const newState = Cards.moveCard(state, poolId, "discardPile", cardId);
  return {
    ...newState,
    activeColor: card.color,
    selectedCardId: null,
  };
}

function aiTurn(
  state: CrazyEightsState,
  poolId: "opponent1" | "opponent2",
): CrazyEightsState {
  const hand = state.pools[poolId];
  const top = topDiscard(state);
  const playable = getPlayableCards(hand, state.activeColor, top);

  if (playable.length > 0) {
    const card = playable[0];
    let newState = playCardToDiscard(state, poolId, card.id);
    if (card.value === 8) {
      const colorCounts = new Map<CardColor, number>();
      for (const c of newState.pools[poolId]) {
        colorCounts.set(c.color, (colorCounts.get(c.color) ?? 0) + 1);
      }
      let bestColor = card.color;
      let bestCount = 0;
      for (const [color, count] of colorCounts) {
        if (count > bestCount) {
          bestColor = color;
          bestCount = count;
        }
      }
      newState = { ...newState, activeColor: bestColor };
    }
    return newState;
  }

  // Must draw — if draw pile is empty, reshuffle discard (minus top card)
  if (state.pools.drawPile.length === 0) {
    const discardTop = topDiscard(state);
    const toReshuffle = state.pools.discardPile.slice(0, -1);
    const reshuffled: CrazyEightsState = {
      ...state,
      pools: {
        ...state.pools,
        drawPile: Cards.shuffle(toReshuffle),
        discardPile: [discardTop],
      },
    };
    if (reshuffled.pools.drawPile.length === 0) return reshuffled;
    return Cards.drawToPool(reshuffled, "drawPile", poolId);
  }

  return Cards.drawToPool(state, "drawPile", poolId);
}

// --- Initial State ---

export const initialState: CrazyEightsState = {
  pools: {
    drawPile: [],
    discardPile: [],
    player: [],
    opponent1: [],
    opponent2: [],
  },
  currentPlayer: "player",
  activeColor: "red",
  selectedCardId: null,
  result: null,
  message: null,
};

// --- State Machine ---

export const crazyEightsConfig: StateMachineConfig<
  CrazyEightsState,
  CrazyEightsCommand,
  CrazyEightsEvent
> = {
  id: "crazy-eights",
  initial: "setup",
  states: {
    setup: {
      autoadvance: true,
      onEnter: async (_, __, { emit }) => {
        nextCardId = 0;
        const deck = Cards.shuffle(createDeck());
        let state: CrazyEightsState = {
          ...initialState,
          pools: {
            ...initialState.pools,
            drawPile: deck,
          },
        };
        // Deal 7 cards to each player
        state = Cards.dealFromPool(
          state,
          "drawPile",
          ["player", "opponent1", "opponent2"],
          7,
        );
        // Flip top card to discard pile
        state = Cards.drawToPool(state, "drawPile", "discardPile");
        const top = topDiscard(state);
        return { ...state, activeColor: top.color, message: null };
      },
      getNext: () => "playerTurn",
    },

    playerTurn: {
      onEnter: (state) => ({
        ...state,
        currentPlayer: "player" as const,
        selectedCardId: null,
        message: null,
      }),
      actions: {
        selectCard: {
          validate: (state, cmd) =>
            state.pools.player.some((c) => c.id === cmd.cardId),
          execute: (state, cmd) => ({
            ...state,
            selectedCardId:
              state.selectedCardId === cmd.cardId ? null : cmd.cardId,
          }),
        },
        playCard: {
          validate: (state) => {
            if (!state.selectedCardId) return false;
            const card = state.pools.player.find(
              (c) => c.id === state.selectedCardId,
            );
            if (!card) return false;
            return canPlayCard(card, state.activeColor, topDiscard(state));
          },
          execute: async (state, _, { emit }) => {
            const card = state.pools.player.find(
              (c) => c.id === state.selectedCardId,
            )!;
            const newState = playCardToDiscard(
              state,
              "player",
              state.selectedCardId!,
            );
            if (card.value === 8) {
              const chosenColor = await emit({ type: "chooseWildColor" });
              return { ...newState, activeColor: chosenColor };
            }
            return newState;
          },
        },
        drawCard: {
          validate: (state) => {
            const playable = getPlayableCards(
              state.pools.player,
              state.activeColor,
              topDiscard(state),
            );
            return playable.length === 0 && state.pools.drawPile.length > 0;
          },
          execute: (state) => {
            if (state.pools.drawPile.length === 0) return state;
            return Cards.drawToPool(state, "drawPile", "player");
          },
        },
      },
      getNext: (state) => {
        if (state.pools.player.length === 0) return "settle";
        return "opponent1Turn";
      },
    },

    opponent1Turn: {
      autoadvance: true,
      onEnter: async (state, _, { emit }) => {
        const newState = aiTurn(
          { ...state, currentPlayer: "opponent1" },
          "opponent1",
        );
        if (newState.pools.discardPile.length > state.pools.discardPile.length) {
          const card =
            newState.pools.discardPile[newState.pools.discardPile.length - 1];
          await emit({ type: "aiCardPlayed", card, player: "opponent1" });
        } else {
          await emit({ type: "aiCardDrawn", player: "opponent1" });
        }
        return newState;
      },
      getNext: (state) => {
        if (state.pools.opponent1.length === 0) return "settle";
        return "opponent2Turn";
      },
    },

    opponent2Turn: {
      autoadvance: true,
      onEnter: async (state, _, { emit }) => {
        const newState = aiTurn(
          { ...state, currentPlayer: "opponent2" },
          "opponent2",
        );
        if (newState.pools.discardPile.length > state.pools.discardPile.length) {
          const card =
            newState.pools.discardPile[newState.pools.discardPile.length - 1];
          await emit({ type: "aiCardPlayed", card, player: "opponent2" });
        } else {
          await emit({ type: "aiCardDrawn", player: "opponent2" });
        }
        return newState;
      },
      getNext: (state) => {
        if (state.pools.opponent2.length === 0) return "settle";
        return "playerTurn";
      },
    },

    settle: {
      onEnter: (state) => {
        const result = state.pools.player.length === 0 ? "win" : "lose";
        let winner = "You";
        if (state.pools.opponent1.length === 0) winner = "Opponent 1";
        if (state.pools.opponent2.length === 0) winner = "Opponent 2";
        return {
          ...state,
          result,
          message: result === "win" ? "You win!" : `${winner} wins!`,
        };
      },
      getNext: () => "setup",
    },
  },
};
