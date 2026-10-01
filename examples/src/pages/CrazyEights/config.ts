import type {
  GenericCardGameState,
  GenericCardInstance,
  StateMachineConfig,
} from "@drock07/board-game-toolkit-core";
import {
  type Rng,
  dealFromPool,
  drawToPool,
  moveCard,
  shuffle,
} from "@drock07/board-game-toolkit-core";

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
  | { type: "selectCard"; cardId: string | null }
  | { type: "playCard" }
  | { type: "drawCard" }
  | { type: "pass" };

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

/**
 * When the draw pile is empty, shuffles the discard pile (minus its top card)
 * back into it. Returns the state unchanged if the draw pile still has cards.
 */
function refillDrawPile(state: CrazyEightsState, rng: Rng): CrazyEightsState {
  if (state.pools.drawPile.length > 0) return state;
  const discardTop = topDiscard(state);
  return {
    ...state,
    pools: {
      ...state.pools,
      drawPile: shuffle(state.pools.discardPile.slice(0, -1), rng),
      discardPile: [discardTop],
    },
  };
}

/** True if a card can be drawn, counting discards that can be reshuffled in. */
function hasCardsToDraw(state: CrazyEightsState): boolean {
  return state.pools.drawPile.length > 0 || state.pools.discardPile.length > 1;
}

function hasPlayableCard(
  state: CrazyEightsState,
  poolId: CrazyEightsPlayer,
): boolean {
  return (
    getPlayableCards(state.pools[poolId], state.activeColor, topDiscard(state))
      .length > 0
  );
}

/** The player must draw when they have no playable card and cards remain. */
export function canDrawCard(state: CrazyEightsState): boolean {
  return !hasPlayableCard(state, "player") && hasCardsToDraw(state);
}

/** The player may pass only when they can neither play nor draw. */
export function mustPass(state: CrazyEightsState): boolean {
  return !hasPlayableCard(state, "player") && !hasCardsToDraw(state);
}

function playCardToDiscard(
  state: CrazyEightsState,
  poolId: CrazyEightsPoolId,
  cardId: string,
): CrazyEightsState {
  const card = state.pools[poolId].find((c) => c.id === cardId)!;
  const newState = moveCard(state, poolId, "discardPile", cardId);
  return {
    ...newState,
    activeColor: card.color,
    selectedCardId: null,
  };
}

function aiTurn(
  state: CrazyEightsState,
  poolId: "opponent1" | "opponent2",
  rng: Rng,
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

  // Must draw (reshuffling the discard pile if needed), or pass if no cards remain
  if (!hasCardsToDraw(state)) return state;
  return drawToPool(refillDrawPile(state, rng), "drawPile", poolId);
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
      onEnter: (_state, _data, { rng }) => {
        nextCardId = 0;
        const deck = shuffle(createDeck(), rng);
        let state: CrazyEightsState = {
          ...initialState,
          pools: {
            ...initialState.pools,
            drawPile: deck,
          },
        };
        // Deal 7 cards to each player
        state = dealFromPool(
          state,
          "drawPile",
          ["player", "opponent1", "opponent2"],
          7,
        );
        // Flip top card to discard pile
        state = drawToPool(state, "drawPile", "discardPile");
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
            cmd.cardId === null ||
            state.pools.player.some((c) => c.id === cmd.cardId),
          execute: (state, cmd) => ({ ...state, selectedCardId: cmd.cardId }),
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
          validate: canDrawCard,
          execute: (state, _cmd, { rng }) =>
            drawToPool(refillDrawPile(state, rng), "drawPile", "player"),
        },
        pass: {
          validate: mustPass,
          execute: (state) => state,
        },
      },
      getNext: (state) => {
        if (state.pools.player.length === 0) return "settle";
        return "opponent1Turn";
      },
    },

    opponent1Turn: {
      autoadvance: true,
      onEnter: async (state, _, { emit, rng }) => {
        const newState = aiTurn(
          { ...state, currentPlayer: "opponent1" },
          "opponent1",
          rng,
        );
        if (
          newState.pools.discardPile.length > state.pools.discardPile.length
        ) {
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
      onEnter: async (state, _, { emit, rng }) => {
        const newState = aiTurn(
          { ...state, currentPlayer: "opponent2" },
          "opponent2",
          rng,
        );
        if (
          newState.pools.discardPile.length > state.pools.discardPile.length
        ) {
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
