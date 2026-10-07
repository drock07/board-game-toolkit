import {
  defaultNodes,
  define,
  entity,
  zone,
  type Entity,
  type EntityId,
  type PlayerId,
  type Reader,
} from "@drock07/board-game-toolkit-engine";

export const COLORS = ["red", "blue", "green", "yellow"] as const;
export type Color = (typeof COLORS)[number];

// #region types
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
// #endregion types

// #region box
// Colored cards, not the shared playing cards: their own entity type
export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
// Only the top card of the pile shows
export const discard = zone("discard", { holds: card, visibility: "top" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
// #endregion box

/** Anything that can read the cards: a reader or a transaction. */
type Cards = Pick<Reader<Vars>, "vars" | "entities" | "count">;

export const topCard = (s: Cards): Card => s.entities(discard)[0]!.props;

export function canPlay(c: Card, activeColor: Color, top: Card): boolean {
  return c.value === 8 || c.color === activeColor || c.value === top.value;
}

/** A player's playable cards. */
export function playable(s: Cards, player: PlayerId): Entity<Card>[] {
  const top = topCard(s);
  return s
    .entities(hand.of(player))
    .filter((e) => canPlay(e.props, s.vars.activeColor, top));
}

/** A card can be drawn, counting discards that can be reshuffled in. */
export const canDraw = (s: Cards) => s.count(deck) > 0 || s.count(discard) > 1;

const { rules, action, loop, seq, step, turns, prompt, outcomes } =
  define<Vars>({ zones: [deck, discard, hand] }).withNodes(defaultNodes);

// #region actions
export const playCard = action("playCard", {
  enumerate: (s, actor) => playable(s, actor).map((e) => ({ card: e.id })),
  validate(s, { card: id }: { card: EntityId }, actor) {
    if (!s.entities(hand.of(actor)).some((e) => e.id === id))
      return "That card isn't in your hand";
    if (!playable(s, actor).some((e) => e.id === id))
      return "That card doesn't match";
    return true;
  },
  execute(tx, { card: id }) {
    tx.move(id, discard);
    const top = topCard(tx);
    tx.vars.activeColor = top.color;
    if (top.value === 8) return { exit: "wild" };
  },
});

export const drawCard = action("drawCard", {
  validate(s, actor) {
    if (playable(s, actor).length) return "You have a card you can play";
    if (!canDraw(s)) return "There are no cards to draw";
    return true;
  },
  execute(tx, actor) {
    // Reshuffle the discards, keeping the top card, when the deck runs out
    if (tx.count(deck) === 0) {
      tx.move(
        tx
          .entities(discard)
          .slice(1)
          .map((e) => e.id),
        deck,
      );
      tx.shuffle(deck);
    }
    tx.moveTop(deck, hand.of(actor));
  },
});

export const pass = action("pass", {
  validate: (s, actor) =>
    playable(s, actor).length || canDraw(s)
      ? "You can still play or draw"
      : true,
  execute: () => {},
});

// #region setColor
export const setColor = action("setColor", {
  enumerate: () => COLORS.map((color) => ({ color })),
  validate: (_s, { color }) =>
    COLORS.includes(color) ? true : "Pick one of the four colors",
  execute(tx, { color }) {
    tx.vars.activeColor = color;
  },
});
// #endregion setColor

export const again = action("again", { execute: () => {} });
// #endregion actions

// #region rules
export const crazyEights = rules({
  players: [2, 5],
  setup(tx) {
    for (const color of COLORS) {
      for (let value = 1; value <= 8; value++) {
        tx.create(card, { color, value }, deck);
        tx.create(card, { color, value }, deck);
      }
    }
    tx.vars = { activeColor: "red", winner: null };
  },
  // Games repeat forever: deal, take turns until a hand empties, wait
  flow: loop(
    {},
    seq(
      step((tx) => {
        const back = [
          ...tx.entities(discard),
          ...tx.players.flatMap((p) => tx.entities(hand.of(p))),
        ];
        tx.move(
          back.map((e) => e.id),
          deck,
        );
        tx.shuffle(deck);
        for (let round = 0; round < 7; round++)
          for (const p of tx.players) tx.moveTop(deck, hand.of(p));
        tx.moveTop(deck, discard);
        tx.vars.activeColor = topCard(tx).color;
        tx.vars.winner = null;
      }),
      turns(
        {
          until: (s) => s.players.some((p) => s.count(hand.of(p)) === 0),
        },
        // Playing an eight raises "wild": its player then calls a color
        outcomes(
          { wild: { then: prompt({ label: "Call a color" }, setColor) } },
          prompt({ label: "Play or draw" }, playCard, drawCard, pass),
        ),
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
