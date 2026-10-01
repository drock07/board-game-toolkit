import type { EntityId, GameImpl } from "@drock07/board-game-toolkit-engine";
import { createDeck } from "../shared/cards";

/** The sandbox keeps everything in zones, so it has no vars. */
export type Vars = Record<string, never>;

export type DiscardArgs = { card: EntityId };

export const impl = {
  setup(tx) {
    createDeck(tx, "deck");
    tx.shuffle("deck");
  },
  actions: {
    draw: {
      validate: (s) => (s.count("deck") > 0 ? true : "The deck is empty"),
      execute: (tx) => void tx.moveTop("deck", "hand"),
    },
    discard: {
      validate: (s, args: DiscardArgs) =>
        s.zone("hand").items.includes(args.card)
          ? true
          : "That card isn't in your hand",
      execute: (tx, args: DiscardArgs) => tx.move(args.card, "discard"),
    },
    shuffleBack: {
      validate: (s) =>
        s.count("discard") > 0 ? true : "The discard pile is empty",
      execute(tx) {
        tx.move([...tx.state.zones.discard!.items], "deck");
        tx.shuffle("deck");
      },
    },
  },
} satisfies GameImpl<Vars>;
