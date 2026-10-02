import type {
  DeepReadonly,
  EntityId,
  GameImpl,
  GameState,
  PlayerId,
  TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type Color = (typeof COLORS)[number];

/** Values run 1–8, two of each per color: 64 cards. Eights are wild. */
export interface Card {
  color: Color;
  value: number;
}

export interface Vars {
  /** The color to follow; an eight's player picks it. */
  activeColor: Color;
  winner: PlayerId | null;
}

/** The reference example of a full type bundle. */
export type Types = TypesFor<
  typeof spec,
  { vars: Vars; entities: { card: Card } }
>;

export type PlayArgs = { card: EntityId };

/** Anything that can see the state: a reader, a transaction, or a bot's view. */
type Reader = { readonly state: DeepReadonly<GameState<Types>> };

const handOf = (player: PlayerId) => `hand:${player}` as const;

/** The cards in a player's hand, top first. */
export function hand(s: Reader, player: PlayerId) {
  const { zones, entities } = s.state;
  return (zones[handOf(player)]?.items ?? []).map((id) => entities[id]!);
}

export function topCard(s: Reader): Card {
  const { zones, entities } = s.state;
  return entities[zones.discard.items[0]!]!.props;
}

export function canPlay(card: Card, activeColor: Color, top: Card): boolean {
  return (
    card.value === 8 || card.color === activeColor || card.value === top.value
  );
}

/** The ids of a player's playable cards. */
export function playable(s: Reader, player: PlayerId): EntityId[] {
  const top = topCard(s);
  const color = s.state.vars.activeColor;
  return hand(s, player)
    .filter((e) => canPlay(e.props, color, top))
    .map((e) => e.id);
}

/** A card can be drawn, counting discards that can be reshuffled in. */
export const canDraw = (s: Reader) =>
  s.state.zones.deck.items.length > 0 || s.state.zones.discard.items.length > 1;

export const impl = {
  setup(tx) {
    for (const color of COLORS) {
      for (let value = 1; value <= 8; value++) {
        tx.create("card", { color, value }, "deck");
        tx.create("card", { color, value }, "deck");
      }
    }
    tx.vars = { activeColor: "red", winner: null };
  },
  conditions: {
    playedEight: (s) => topCard(s).value === 8,
    someHandEmpty: (s) => s.players.some((p) => s.count(handOf(p)) === 0),
  },
  lists: {
    colors: () => [...COLORS],
  },
  steps: {
    dealSeven(tx) {
      const { players, zones } = tx.state;
      tx.move(
        [
          ...zones.discard.items,
          ...players.flatMap((p) => zones[handOf(p)]!.items),
        ],
        "deck",
      );
      tx.shuffle("deck");
      for (let round = 0; round < 7; round++) {
        for (const p of players) tx.moveTop("deck", handOf(p));
      }
      tx.moveTop("deck", "discard");
      tx.vars.activeColor = topCard(tx).color;
      tx.vars.winner = null;
    },
    announceWinner(tx) {
      tx.vars.winner =
        tx.state.players.find((p) => hand(tx, p).length === 0) ?? null;
    },
  },
  choices: {
    setColor(tx, [color]) {
      tx.vars.activeColor = color as Color;
    },
  },
  actions: {
    playCard: {
      enumerate: (s, scope): PlayArgs[] =>
        playable(s, scope.actor!).map((card) => ({ card })),
      validate(s, args: PlayArgs, scope) {
        if (!hand(s, scope.actor!).some((e) => e.id === args.card))
          return "That card isn't in your hand";
        if (!playable(s, scope.actor!).includes(args.card))
          return "That card doesn't match";
        return true;
      },
      execute(tx, args: PlayArgs) {
        tx.move(args.card, "discard");
        tx.vars.activeColor = topCard(tx).color;
      },
    },
    drawCard: {
      validate(s, _args, scope) {
        if (playable(s, scope.actor!).length)
          return "You have a card you can play";
        if (!canDraw(s)) return "There are no cards to draw";
        return true;
      },
      execute(tx) {
        // Reshuffle the discards, keeping the top card, when the deck runs out
        if (tx.state.zones.deck.items.length === 0) {
          tx.move(tx.state.zones.discard.items.slice(1), "deck");
          tx.shuffle("deck");
        }
        tx.moveTop("deck", handOf(tx.scope.actor!));
      },
    },
    pass: {
      validate: (s, _args, scope) =>
        playable(s, scope.actor!).length || canDraw(s)
          ? "You can still play or draw"
          : true,
      execute: () => {},
    },
  },
} satisfies GameImpl<Types>;
