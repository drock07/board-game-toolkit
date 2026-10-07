// Plus Two. A small Uno-style game whose +2 cards stack. Playing a +2 opens
// a window: any other player may stack another +2 on it, passing the growing
// penalty to the next seat, or the victim takes it. First empty hand wins.
//
// The old engine runs the window as a trigger on "a +2 moved to the
// discard", nesting a window per stack. Here it's a loop after each turn:
// while a penalty is pending, the first answer wins.
import type { PlayerId } from "../index.js";
import {
  defaultNodes,
  define,
  entity,
  zone,
  type Reader,
  type Tx,
} from "../index.js";

export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type Color = (typeof COLORS)[number];
export const VALUES = ["0", "1", "2", "3", "4", "5", "+2"] as const;
export type Value = (typeof VALUES)[number];

export interface Card {
  color: Color;
  value: Value;
}

export interface Vars {
  /** Cards the victim draws if they take it; 0 when no window is open. */
  penalty: number;
  /** Who played the newest +2; they can't stack on their own. */
  stacker: PlayerId | null;
  /** Who the newest +2 targets: the seat after the stacker. */
  victim: PlayerId | null;
  winner: PlayerId | null;
}

export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const discard = zone("discard", { holds: card });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});

const { rules, action, seq, step, turns, loop, prompt, anyone } = define<Vars>({
  zones: [deck, discard, hand],
}).withNodes(defaultNodes);

export const HAND_SIZE = 5;

const top = (s: Reader<Vars>) => s.entities(discard)[0]!.props;
const matches = (c: Card, on: Card) =>
  c.color === on.color || c.value === on.value;
const playable = (s: Reader<Vars>, p: PlayerId) =>
  s.entities(hand.of(p)).filter((e) => matches(e.props, top(s)));
const plusTwos = (s: Reader<Vars>, p: PlayerId) =>
  s.entities(hand.of(p)).filter((e) => e.props.value === "+2");
const canDraw = (s: Reader<Vars>) => s.count(deck) > 0 || s.count(discard) > 1;

export const nextAfter = (players: readonly PlayerId[], p: PlayerId) =>
  players[(players.indexOf(p) + 1) % players.length]!;

/** Draws up to `count`, reshuffling all but the top discard when the deck runs out. */
function draw(tx: Tx<Vars>, p: PlayerId, count: number) {
  for (let i = 0; i < count; i++) {
    if (tx.count(deck) === 0) {
      const rest = tx.entities(discard).slice(1);
      if (!rest.length) return;
      tx.move(
        rest.map((e) => e.id),
        deck,
      );
      tx.shuffle(deck);
    }
    tx.moveTop(deck, hand.of(p));
  }
}

/** Plays a card; a +2 opens (or passes on) the penalty window. */
function playCard(tx: Tx<Vars>, id: string, actor: PlayerId) {
  tx.move(id, discard);
  if (top(tx).value === "+2") {
    tx.vars.penalty += 2;
    tx.vars.stacker = actor;
    tx.vars.victim = nextAfter(tx.players, actor);
  }
}

const someHandEmpty = (s: Reader<Vars>) =>
  s.players.some((p) => s.count(hand.of(p)) === 0);

export const plusTwo = rules({
  players: [2, 4],
  setup: (tx) => {
    tx.vars = { penalty: 0, stacker: null, victim: null, winner: null };
    for (const color of COLORS)
      for (const value of VALUES)
        for (let copy = 0; copy < 2; copy++)
          tx.create(card, { color, value }, deck);
  },
  flow: seq(
    step((tx) => {
      tx.shuffle(deck);
      for (const p of tx.players) tx.moveTop(deck, hand.of(p), HAND_SIZE);
      tx.moveTop(deck, discard);
    }),
    turns(
      { until: someHandEmpty },
      seq(
        prompt(
          action("play", {
            enumerate: (s, actor) =>
              playable(s, actor).map((e) => ({ card: e.id })),
            execute: (tx, { card: id }, actor) => playCard(tx, id, actor),
          }),
          action("draw", {
            validate: (s, actor) =>
              playable(s, actor).length
                ? "You have a card you can play"
                : canDraw(s)
                  ? true
                  : "There are no cards to draw",
            execute: (tx, actor) => draw(tx, actor, 1),
          }),
          action("pass", {
            validate: (s, actor) =>
              playable(s, actor).length || canDraw(s)
                ? "You can still play or draw"
                : true,
            execute: () => {},
          }),
        ),
        // The window: until someone takes the penalty, anyone but the
        // stacker may stack another +2, and the victim may take it
        loop(
          { until: (s) => s.vars.penalty === 0 },
          anyone(
            { who: (s) => s.players.filter((p) => p !== s.vars.stacker) },
            action("stack", {
              enumerate: (s, actor) =>
                plusTwos(s, actor).map((e) => ({ card: e.id })),
              execute: (tx, { card: id }, actor) => playCard(tx, id, actor),
            }),
            action("accept", {
              validate: (s, actor) =>
                s.vars.victim === actor ? true : "The penalty isn't yours",
              execute: (tx, actor) => {
                draw(tx, actor, tx.vars.penalty);
                tx.vars.penalty = 0;
                tx.vars.stacker = null;
                tx.vars.victim = null;
              },
            }),
          ),
        ),
      ),
    ),
    step((tx) => {
      tx.vars.winner =
        tx.players.find((p) => tx.count(hand.of(p)) === 0) ?? null;
      tx.end({ winner: tx.vars.winner });
    }),
  ),
});
