import type {
  GenericCardGameState,
  PlayingCard,
  StateMachineConfig,
} from "@drock07/board-game-toolkit-core";
import {
  addToPool,
  createPlayingCardDeck,
  drawToPool,
  moveCard,
  shuffle,
  shufflePool,
} from "@drock07/board-game-toolkit-core";

export type DemoPoolId = "deck" | "hand" | "discard";
export type DemoCard = PlayingCard & { id: string };
export type DemoState = GenericCardGameState<DemoPoolId, DemoCard>;

export type DemoCommand =
  | { type: "draw" }
  | { type: "discard"; cardId: string }
  | { type: "shuffleBack" };

function createDeck(): DemoCard[] {
  return createPlayingCardDeck().map((c) => ({
    ...c,
    id: `${c.suit}-${c.rank}`,
  }));
}

export const initialState: DemoState = {
  pools: {
    deck: shuffle(createDeck()),
    hand: [],
    discard: [],
  },
};

export const config: StateMachineConfig<DemoState, DemoCommand> = {
  id: "card-pools",
  initial: "idle",
  states: {
    idle: {
      actions: {
        draw: {
          validate: (state) => state.pools.deck.length > 0,
          execute: (state) => drawToPool(state, "deck", "hand"),
        },
        discard: {
          validate: (state, cmd) =>
            state.pools.hand.some((c) => c.id === cmd.cardId),
          execute: (state, cmd) =>
            moveCard(state, "hand", "discard", cmd.cardId),
        },
        shuffleBack: {
          validate: (state) => state.pools.discard.length > 0,
          execute: (state) => {
            let next = addToPool(state, "deck", state.pools.discard);
            next = { ...next, pools: { ...next.pools, discard: [] } };
            return shufflePool(next, "deck");
          },
        },
      },
    },
  },
};
