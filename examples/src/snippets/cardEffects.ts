// The card effects guide's game: a small duel. A Strike causes an Attack;
// a Shield may block it; Thorns in play strikes back for damage taken; a
// Bomb goes off when it enters a hand, by any route. Each card's rule is
// one declaration, and the turn knows nothing about any of them.
import {
  defaultNodes,
  define,
  entity,
  zone,
  type EntityId,
  type PlayerId,
  type Reader,
} from "@drock07/board-game-toolkit-engine";

export type CardName = "Strike" | "Shield" | "Thorns" | "Bomb";

export interface Vars {
  hp: Record<PlayerId, number>;
}

export const card = entity<{ name: CardName }>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
export const play = zone("play", { holds: card, perPlayer: true });
export const discard = zone("discard", { holds: card });

/** Exported so tests can build variants with the same box. */
export const core = define<Vars>({
  zones: [deck, hand, play, discard],
}).withNodes(defaultNodes);
const { rules, action, effect, ability, outcomes, prompt, seq, step, turns } =
  core;

const named = (name: CardName) => (c: { props: { name: CardName } }) =>
  c.props.name === name;

// #region effects
export interface Attack {
  by: PlayerId;
  target: PlayerId;
  damage: number;
  /** Set by a reaction before the Attack resolves. */
  blocked: boolean;
}
export interface Damage {
  to: PlayerId;
  amount: number;
  /** Who attacked, when an Attack dealt it. */
  from?: PlayerId;
}

export const damage = effect("damage", {
  resolve: (tx, d: Damage) => void (tx.vars.hp[d.to]! -= d.amount),
});

// An Attack that isn't blocked causes Damage: one effect causing another
export const attack = effect("attack", {
  resolve: (tx, a: Attack) => {
    if (!a.blocked)
      tx.cause(damage, { to: a.target, amount: a.damage, from: a.by });
  },
});
// #endregion effects

// #region bomb
/** Bomb: entering your hand, by a draw or a deal, it goes off for 3. */
export const bomb = ability({
  of: card,
  where: named("Bomb"),
  in: hand,
  on: "enters",
  then: (t) =>
    step((tx) => {
      tx.move(t.self(tx).id, discard);
      tx.cause(damage, { to: t.owner(tx)!, amount: 3 });
    }),
});
// #endregion bomb

// #region thorns
/** Thorns: while in your play zone, an Attack that damages you costs the attacker 1. */
export const thorns = ability({
  of: card,
  where: named("Thorns"),
  in: play,
  on: damage,
  when: (_s, t) => t.data.to === t.owner && t.data.from !== undefined,
  // Damage without `from`, so Thorns can't answer Thorns
  then: (t) =>
    step((tx) => tx.cause(damage, { to: t.data(tx).from!, amount: 1 })),
});
// #endregion thorns

// #region leaky
/**
 * Shield, carried in a hidden hand: asks its holder before an Attack on them
 * lands. It works, but it leaks: the game waits on the target only when
 * they hold a Shield, and everyone can see who the game waits on.
 */
export const carriedShield = ability({
  of: card,
  where: named("Shield"),
  in: hand,
  on: attack.before,
  when: (_s, t) => t.data.target === t.owner && !t.data.blocked,
  then: (t) =>
    prompt(
      action("block", {
        execute: (tx) => {
          tx.move(t.self(tx).id, discard);
          t.data(tx).blocked = true;
        },
      }),
      action("allow", { execute: () => {} }),
    ),
});
// #endregion leaky

// #region shield
const shieldsOf = (s: Pick<Reader<Vars>, "entities">, p: PlayerId) =>
  s.entities(hand.of(p)).filter(named("Shield"));

/** Shield, as a rule: every Attack asks its target, Shield or not. */
export const shield = ability({
  on: attack.before,
  who: (_s, a) => a.target,
  then: (t) =>
    prompt(
      { label: "Block with a Shield?" },
      action("block", {
        validate: (s, actor) =>
          shieldsOf(s, actor).length ? true : "You hold no Shield",
        execute: (tx, actor) => {
          tx.move(shieldsOf(tx, actor)[0]!.id, discard);
          t.data(tx).blocked = true;
        },
      }),
      action("take", { execute: () => {} }),
    ),
});
// #endregion shield

// #region flow
const opponents = (s: Reader<Vars>, p: PlayerId) =>
  s.players.filter((o) => o !== p);

export const playCard = action("play", {
  enumerate: (s, actor) =>
    s
      .entities(hand.of(actor))
      .flatMap((e): { card: EntityId; target?: PlayerId }[] =>
        e.props.name === "Strike"
          ? opponents(s, actor).map((target) => ({ card: e.id, target }))
          : e.props.name === "Thorns"
            ? [{ card: e.id }]
            : [],
      ),
  execute: (tx, { card: id, target }, actor) => {
    if (!target) return tx.move(id, play.of(actor));
    tx.move(id, discard);
    tx.cause(attack, { by: actor, target, damage: 2, blocked: false });
  },
});
export const pass = action("pass", { execute: () => {} });

export const flow = seq(
  // Dealt in the flow, so a Bomb dealt goes off
  step((tx) => {
    for (const p of tx.players) tx.moveTop(deck, hand.of(p), 3);
  }),
  outcomes(
    { over: { when: (s) => s.players.some((p) => s.vars.hp[p]! <= 0) } },
    turns(
      {},
      seq(
        step((tx) => {
          if (tx.count(deck) === 0) return tx.end();
          tx.moveTop(deck, hand.of(tx.actor!));
        }),
        prompt({ label: "Play a card" }, playCard, pass),
      ),
    ),
  ),
  step((tx) => tx.end()),
);

export const DECK: Record<CardName, number> = {
  Strike: 10,
  Shield: 4,
  Thorns: 3,
  Bomb: 3,
};

export const duel = rules({
  players: [2, 3],
  setup: (tx) => {
    tx.vars = { hp: Object.fromEntries(tx.players.map((p) => [p, 10])) };
    for (const [name, n] of Object.entries(DECK) as [CardName, number][])
      for (let i = 0; i < n; i++) tx.create(card, { name }, deck);
    tx.shuffle(deck);
  },
  abilities: [shield, thorns, bomb],
  flow,
});
// #endregion flow
