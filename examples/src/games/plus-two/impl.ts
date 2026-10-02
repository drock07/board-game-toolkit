import type {
  DeepReadonly,
  EntityId,
  GameImpl,
  GameState,
  PlayerId,
  Tx,
  TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type Color = (typeof COLORS)[number];
export type Value = "0" | "1" | "2" | "3" | "4" | "5" | "+2";

export interface Card {
  color: Color;
  value: Value;
}

export interface Vars {
  /** Cards the current victim draws if they take the penalty. */
  penalty: number;
  /** Who the newest +2 targets; only they can take the penalty. */
  victim: PlayerId | null;
  winner: PlayerId | null;
}

/** Who played the +2 that opened a window, and who it targets. */
export interface WindowLocals {
  stacker: PlayerId;
  victim: PlayerId;
}

export type Types = TypesFor<
  typeof spec,
  { vars: Vars; entities: { card: Card }; locals: { window: WindowLocals } }
>;

export type CardArgs = { card: EntityId };

const HAND_SIZE = 5;
const handOf = (player: PlayerId) => `hand:${player}` as const;

type Reader = { readonly state: DeepReadonly<GameState<Types>> };

export function hand(s: Reader, player: PlayerId) {
  const { zones, entities } = s.state;
  return (zones[handOf(player)]?.items ?? []).map((id) => entities[id]!);
}

export const topCard = (s: Reader): Card =>
  s.state.entities[s.state.zones.discard.items[0]!]!.props;

export const matches = (card: Card, top: Card) =>
  card.color === top.color || card.value === top.value;

const playable = (s: Reader, player: PlayerId) =>
  hand(s, player).filter((e) => matches(e.props, topCard(s)));

const plusTwos = (s: Reader, player: PlayerId) =>
  hand(s, player).filter((e) => e.props.value === "+2");

const canDraw = (s: Reader) =>
  s.state.zones.deck.items.length > 0 || s.state.zones.discard.items.length > 1;

/** The next seat after `player`. */
export const nextAfter = (players: readonly PlayerId[], player: PlayerId) =>
  players[(players.indexOf(player) + 1) % players.length]!;

/** Draws up to `count`, reshuffling all but the top discard when the deck runs out. */
function draw(tx: Tx<Types>, player: PlayerId, count: number) {
  for (let i = 0; i < count; i++) {
    if (tx.state.zones.deck.items.length === 0) {
      const rest = tx.state.zones.discard.items.slice(1);
      if (!rest.length) return;
      tx.move(rest, "deck");
      tx.shuffle("deck");
    }
    tx.moveTop("deck", handOf(player));
  }
}

export const impl = {
  setup(tx) {
    for (const color of COLORS) {
      for (const value of ["0", "1", "2", "3", "4", "5", "+2"] as const) {
        tx.create("card", { color, value }, "deck");
        tx.create("card", { color, value }, "deck");
      }
    }
    tx.vars = { penalty: 0, victim: null, winner: null };
  },
  conditions: {
    someHandEmpty: (s) => s.players.some((p) => s.count(handOf(p)) === 0),
    plusTwoPlayed: (s, scope) =>
      scope.event?.type === "moved" &&
      s.entity(scope.event.ids[0]!).props.value === "+2",
  },
  locals: {
    // Built from the triggering event: the card came from the stacker's hand
    window(s, scope): WindowLocals {
      const event = scope.event!;
      const from = event.type === "moved" ? event.from[0]! : "";
      const stacker = from.slice(from.indexOf(":") + 1);
      return { stacker, victim: nextAfter(s.players, stacker) };
    },
  },
  lists: {
    responders: (s) => s.players.filter((p) => p !== s.local("window").stacker),
    victim: (s) => [s.local("window").victim],
  },
  steps: {
    deal(tx) {
      const { players, zones } = tx.state;
      tx.move(
        [
          ...zones.discard.items,
          ...players.flatMap((p) => zones[handOf(p)]!.items),
        ],
        "deck",
      );
      tx.shuffle("deck");
      for (let i = 0; i < HAND_SIZE; i++)
        for (const p of players) tx.moveTop("deck", handOf(p));
      tx.moveTop("deck", "discard");
      tx.vars = { penalty: 0, victim: null, winner: null };
    },
    addPenalty(tx) {
      tx.vars.penalty += 2;
      tx.vars.victim = tx.local("window").victim;
    },
    announceWinner(tx) {
      tx.vars.winner =
        tx.state.players.find((p) => hand(tx, p).length === 0) ?? null;
    },
  },
  actions: {
    playCard: {
      enumerate: (s, scope): CardArgs[] =>
        playable(s, scope.actor!).map((e) => ({ card: e.id })),
      validate(s, { card }: CardArgs, scope) {
        if (!playable(s, scope.actor!).some((e) => e.id === card))
          return "You can't play that";
        return true;
      },
      execute: (tx, { card }: CardArgs) => tx.move(card, "discard"),
    },
    drawCard: {
      validate(s, _args, scope) {
        if (playable(s, scope.actor!).length)
          return "You have a card you can play";
        return canDraw(s) ? true : "There are no cards to draw";
      },
      execute: (tx) => draw(tx, tx.scope.actor!, 1),
    },
    pass: {
      validate: (s, _args, scope) =>
        playable(s, scope.actor!).length || canDraw(s)
          ? "You can still play or draw"
          : true,
      execute: () => {},
    },
    stackPlusTwo: {
      enumerate: (s, scope): CardArgs[] =>
        plusTwos(s, scope.actor!).map((e) => ({ card: e.id })),
      validate: (s, { card }: CardArgs, scope) =>
        plusTwos(s, scope.actor!).some((e) => e.id === card)
          ? true
          : "Stack a +2 from your hand",
      // Playing it fires the trigger again: a window inside this one
      execute: (tx, { card }: CardArgs) => tx.move(card, "discard"),
    },
    accept: {
      // Only while this window's +2 is the newest; a stack moves the penalty on
      validate: (s, _args, scope) =>
        s.vars.victim === scope.actor &&
        s.vars.victim === s.local("window").victim
          ? true
          : "The penalty has moved on",
      execute(tx) {
        draw(tx, tx.scope.actor!, tx.vars.penalty);
        tx.vars.penalty = 0;
        tx.vars.victim = null;
      },
    },
  },
} satisfies GameImpl<Types>;
