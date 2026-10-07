import {
  defaultNodes,
  define,
  entity,
  zone,
  type PlayerId,
  type Reader,
  type Tx,
} from "@drock07/board-game-toolkit-engine";

export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type Color = (typeof COLORS)[number];
export const VALUES = ["0", "1", "2", "3", "4", "5", "+2"] as const;
export type Value = (typeof VALUES)[number];

export interface Card {
  color: Color;
  value: Value;
}

// #region types
export interface Vars {
  /** Cards the victim draws if they take it; 0 when no window is open. */
  penalty: number;
  /** Who played the newest +2; they can't stack on their own. */
  stacker: PlayerId | null;
  /** Who the newest +2 targets: the seat after the stacker. */
  victim: PlayerId | null;
  winner: PlayerId | null;
}

// Uno-style color cards, not playing cards, so this game has its own type
export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
// Only the top card of the pile shows
export const discard = zone("discard", { holds: card, visibility: "top" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
// #endregion types

const { rules, action, loop, seq, step, turns, prompt, anyone } = define<Vars>({
  zones: [deck, discard, hand],
}).withNodes(defaultNodes);

export const HAND_SIZE = 5;
export const TURN_LABEL = "Play, draw or pass";
export const WINDOW_LABEL = "Stack a +2 or take the penalty";

export const topCard = (s: Reader<Vars>) => s.entities(discard)[0]!.props;
export const matches = (c: Card, on: Card) =>
  c.color === on.color || c.value === on.value;
const playable = (s: Reader<Vars>, p: PlayerId) =>
  s.entities(hand.of(p)).filter((e) => matches(e.props, topCard(s)));
const plusTwos = (s: Reader<Vars>, p: PlayerId) =>
  s.entities(hand.of(p)).filter((e) => e.props.value === "+2");
const canDraw = (s: Reader<Vars>) => s.count(deck) > 0 || s.count(discard) > 1;

/** The next seat after `player`. */
export const nextAfter = (players: readonly PlayerId[], p: PlayerId) =>
  players[(players.indexOf(p) + 1) % players.length]!;

const fresh = (): Vars => ({
  penalty: 0,
  stacker: null,
  victim: null,
  winner: null,
});

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

/** Discards a card; a +2 opens the penalty window, or passes it on. */
function discardCard(tx: Tx<Vars>, id: string, actor: PlayerId) {
  tx.move(id, discard);
  if (topCard(tx).value === "+2") {
    tx.vars.penalty += 2;
    tx.vars.stacker = actor;
    tx.vars.victim = nextAfter(tx.players, actor);
  }
}

const someHandEmpty = (s: Reader<Vars>) =>
  s.players.some((p) => s.count(hand.of(p)) === 0);

// #region actions
export const playCard = action("playCard", {
  enumerate: (s, actor) => playable(s, actor).map((e) => ({ card: e.id })),
  validate: (s, { card: id }, actor) =>
    playable(s, actor).some((e) => e.id === id) ? true : "You can't play that",
  execute: (tx, { card: id }, actor) => discardCard(tx, id, actor),
});

export const drawCard = action("drawCard", {
  validate: (s, actor) =>
    playable(s, actor).length
      ? "You have a card you can play"
      : canDraw(s)
        ? true
        : "There are no cards to draw",
  execute: (tx, actor) => draw(tx, actor, 1),
});

export const pass = action("pass", {
  validate: (s, actor) =>
    playable(s, actor).length || canDraw(s)
      ? "You can still play or draw"
      : true,
  execute: () => {},
});

export const stackPlusTwo = action("stackPlusTwo", {
  enumerate: (s, actor) => plusTwos(s, actor).map((e) => ({ card: e.id })),
  validate: (s, { card: id }, actor) =>
    plusTwos(s, actor).some((e) => e.id === id)
      ? true
      : "Stack a +2 from your hand",
  execute: (tx, { card: id }, actor) => discardCard(tx, id, actor),
});

// #region accept
export const accept = action("accept", {
  // A stack moves the penalty on, so only the newest +2's victim may take it
  validate: (s, actor) =>
    s.vars.victim === actor ? true : "The penalty has moved on",
  execute(tx, actor) {
    draw(tx, actor, tx.vars.penalty);
    tx.vars.penalty = 0;
    tx.vars.stacker = null;
    tx.vars.victim = null;
  },
});
// #endregion accept

export const again = action("again", { execute: () => {} });
// #endregion actions

// #region window
// The window: until someone takes the penalty, anyone but the newest
// stacker may stack another +2 on it, and the victim may take it. The first
// answer wins; a stack goes round again with a bigger penalty.
const window = loop(
  { until: (s) => s.vars.penalty === 0 },
  anyone(
    {
      label: WINDOW_LABEL,
      who: (s) => s.players.filter((p) => p !== s.vars.stacker),
    },
    stackPlusTwo,
    accept,
  ),
);
// #endregion window

// #region rules
export const plusTwo = rules({
  players: [2, 4],
  setup(tx) {
    for (const color of COLORS)
      for (const value of VALUES)
        for (let copy = 0; copy < 2; copy++)
          tx.create(card, { color, value }, deck);
    tx.vars = fresh();
  },
  // Games repeat forever: gather and deal, take turns until a hand is
  // empty, name the winner, wait
  flow: loop(
    {},
    seq(
      step((tx) => {
        const held = [discard, ...tx.zones(hand)].flatMap((z) =>
          tx.entities(z).map((e) => e.id),
        );
        if (held.length) tx.move(held, deck);
        tx.shuffle(deck);
        for (let i = 0; i < HAND_SIZE; i++)
          for (const p of tx.players) tx.moveTop(deck, hand.of(p));
        tx.moveTop(deck, discard);
        tx.vars = fresh();
      }),
      turns(
        { until: someHandEmpty },
        seq(prompt({ label: TURN_LABEL }, playCard, drawCard, pass), window),
      ),
      step((tx) => {
        tx.vars.winner =
          tx.players.find((p) => tx.count(hand.of(p)) === 0) ?? null;
      }),
      prompt({ label: "Play again" }, again),
    ),
  ),
});
// #endregion rules
