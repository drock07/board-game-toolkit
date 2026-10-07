import {
  defaultNodes,
  define,
  zone,
  type EntityId,
} from "@drock07/board-game-toolkit-engine";
import { card, createDeck } from "../shared/cards";

// #region types
// The sandbox keeps everything in zones, so its vars are empty
export type Vars = Record<string, never>;

export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const hand = zone("hand", { holds: card });
export const discardPile = zone("discard", { holds: card });
// #endregion types

const { rules, action, loop, prompt } = define<Vars>({
  zones: [deck, hand, discardPile],
}).withNodes(defaultNodes);

// #region actions
export const draw = action("draw", {
  validate: (s) => (s.count(deck) > 0 ? true : "The deck is empty"),
  execute: (tx) => void tx.moveTop(deck, hand),
});

export const discard = action("discard", {
  enumerate: (s) => s.entities(hand).map((c) => ({ card: c.id })),
  validate: (s, args: { card: EntityId }) =>
    s.entities(hand).some((c) => c.id === args.card)
      ? true
      : "That card isn't in your hand",
  execute: (tx, args) => tx.move(args.card, discardPile),
});

export const shuffleBack = action("shuffleBack", {
  validate: (s) =>
    s.count(discardPile) > 0 ? true : "The discard pile is empty",
  execute(tx) {
    tx.move(
      tx.entities(discardPile).map((c) => c.id),
      deck,
    );
    tx.shuffle(deck);
  },
});
// #endregion actions

// #region rules
export const sandbox = rules({
  players: 1,
  setup(tx) {
    tx.vars = {};
    createDeck(tx, deck);
    tx.shuffle(deck);
  },
  // One prompt, asked again forever: the table never closes
  flow: loop({}, prompt({ label: "Table" }, draw, discard, shuffleBack)),
});
// #endregion rules
