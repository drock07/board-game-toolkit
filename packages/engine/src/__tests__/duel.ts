// Duel: the forcing game for effects and abilities (see ../duel-rules.md).
// Strike causes an Attack, an effect: Shield reacts from a hidden hand
// before it resolves and may prevent it; Thorns reacts from play after it.
// Bomb reacts to entering a hand by any route, in the middle of whoever's
// action moved it. Each card's rule is one declaration; the turn knows
// nothing about any of them.
//
// Readings chosen where the rules are open: a Bomb's "no other card" is
// judged when its reaction starts, not when it arrived; a Bomb that left
// the hand before its reaction started (discarded to defuse another) never
// goes off; Steal can only target an opponent who holds a card.
import type { EntityId, PlayerId } from "../index.js";
import {
  defaultNodes,
  define,
  entity,
  zone,
  type Reader,
  type Tx,
} from "../index.js";

export type CardName = "Strike" | "Shield" | "Thorns" | "Steal" | "Bomb";
export interface Card {
  name: CardName;
}

export interface Vars {
  hp: Record<PlayerId, number>;
}

export interface Attack {
  by: PlayerId;
  target: PlayerId;
  damage: number;
  /** Set by a reaction before the Attack resolves. */
  prevented: boolean;
}

export interface Damage {
  to: PlayerId;
  amount: number;
  /** The Attack that dealt it, if one did. */
  attack?: { by: PlayerId };
}

export const START_HP = 10;
export const HAND_SIZE = 3;
export const DECK: Record<CardName, number> = {
  Strike: 8,
  Shield: 4,
  Thorns: 3,
  Steal: 3,
  Bomb: 2,
};

export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
export const play = zone("play", { holds: card, perPlayer: true });
export const discard = zone("discard", { holds: card });

/** Exported so tests can build variants of the game with the same box. */
export const core = define<Vars>({
  zones: [deck, hand, play, discard],
}).withNodes(defaultNodes);
const {
  rules,
  action,
  effect,
  ability,
  seq,
  step,
  turns,
  prompt,
  branch,
  outcomes,
} = core;

export const alive = (s: Pick<Reader<Vars>, "players" | "vars">) =>
  s.players.filter((p) => (s.vars.hp[p] ?? 0) > 0);

// --- Effects ----------------------------------------------------------------

export const damage = effect("damage", {
  resolve: (tx, d: Damage) => {
    tx.vars.hp[d.to] = (tx.vars.hp[d.to] ?? 0) - d.amount;
  },
});

export const attack = effect("attack", {
  resolve: (tx, a: Attack) => {
    if (!a.prevented)
      tx.cause(damage, {
        to: a.target,
        amount: a.damage,
        attack: { by: a.by },
      });
  },
});

// --- Abilities --------------------------------------------------------------

const named = (name: CardName) => (c: { props: Card }) => c.props.name === name;

/** Shield: while in your hand, when an Attack targets you, you may discard it to prevent the Attack. */
export const shield = ability({
  of: card,
  where: named("Shield"),
  in: hand,
  on: attack,
  timing: "before",
  when: (_s, t) => t.data.target === t.owner && !t.data.prevented,
  then: (t) =>
    prompt(
      action("block", {
        execute: (tx) => {
          tx.move(t.self(tx).id, discard);
          t.data(tx).prevented = true;
        },
      }),
      action("allow", { execute: () => {} }),
    ),
});

/** Thorns: while in your play zone, an Attack that damages you costs the attacker 1 (not an Attack). */
export const thorns = ability({
  of: card,
  where: named("Thorns"),
  in: play,
  on: damage,
  when: (_s, t) => t.data.to === t.owner && t.data.attack !== undefined,
  then: (t) =>
    step((tx) => tx.cause(damage, { to: t.data(tx).attack!.by, amount: 1 })),
});

/** Bomb: entering your hand by any route, defuse it with another card or take 3. */
export const bomb = ability({
  of: card,
  where: named("Bomb"),
  in: hand,
  on: "enters",
  then: (t) => {
    const others = (s: Reader<Vars>) =>
      s.entities(hand.of(t.owner(s)!)).filter((e) => e.id !== t.self(s).id);
    const explode = (tx: Tx<Vars>) => {
      tx.move(t.self(tx).id, discard);
      tx.cause(damage, { to: t.owner(tx)!, amount: 3 });
    };
    return branch(
      [{ when: (s) => others(s).length === 0, then: step(explode) }],
      prompt(
        action("defuse", {
          enumerate: (s) =>
            others(s).map((e): { card: EntityId } => ({ card: e.id })),
          execute: (tx, { card: id }) => {
            tx.move(id, discard);
            tx.move(t.self(tx).id, deck);
            tx.shuffle(deck);
          },
        }),
        action("explode", { execute: explode }),
      ),
    );
  },
});

// --- The game ---------------------------------------------------------------

const opponents = (s: Reader<Vars>, p: PlayerId) =>
  alive(s).filter((o) => o !== p);

/** What `p` may play: Strike and Steal name an opponent, Thorns nobody. */
function plays(s: Reader<Vars>, p: PlayerId) {
  return s
    .entities(hand.of(p))
    .flatMap((e): { card: EntityId; target?: PlayerId }[] => {
      switch (e.props.name) {
        case "Strike":
          return opponents(s, p).map((target) => ({ card: e.id, target }));
        case "Steal":
          return opponents(s, p)
            .filter((o) => s.count(hand.of(o)) > 0)
            .map((target) => ({ card: e.id, target }));
        case "Thorns":
          return [{ card: e.id }];
        default:
          return [];
      }
    });
}

export function setup(tx: Tx<Vars>) {
  tx.vars = { hp: Object.fromEntries(tx.players.map((p) => [p, START_HP])) };
  for (const [name, n] of Object.entries(DECK) as [CardName, number][])
    for (let i = 0; i < n; i++) tx.create(card, { name }, deck);
}

/** The deal, then turns: draw (or end the game on an empty deck), then play or pass. */
export const flow = seq(
  // The deal is in the flow, so Bombs dealt here go off
  step((tx) => {
    tx.shuffle(deck);
    for (const p of tx.players) tx.moveTop(deck, hand.of(p), HAND_SIZE);
  }),
  outcomes(
    { over: { when: (s) => alive(s).length <= 1 } },
    turns(
      { among: alive },
      seq(
        step((tx) => {
          if (tx.count(deck) > 0)
            return void tx.moveTop(deck, hand.of(tx.actor!));
          // An empty deck ends the game: highest HP wins, a tie is a draw
          const best = Math.max(...alive(tx).map((p) => tx.vars.hp[p]!));
          const top = alive(tx).filter((p) => tx.vars.hp[p] === best);
          tx.end({ winner: top.length === 1 ? top[0]! : null });
        }),
        // A Bomb drawn can knock the drawer out before they play
        branch([
          {
            when: (s) => alive(s).includes(s.actor!),
            then: prompt(
              action("play", {
                enumerate: plays,
                execute: (tx, { card: id, target }, actor) => {
                  const { name } = tx.entity(id).props as Card;
                  if (name === "Thorns") return tx.move(id, play.of(actor));
                  tx.move(id, discard);
                  if (name === "Strike")
                    return tx.cause(attack, {
                      by: actor,
                      target: target!,
                      damage: 2,
                      prevented: false,
                    });
                  const theirs = tx.entities(hand.of(target!));
                  const pick = theirs[tx.random.int(0, theirs.length - 1)]!;
                  tx.move(pick.id, hand.of(actor));
                },
              }),
              action("pass", { execute: () => {} }),
            ),
          },
        ]),
      ),
    ),
  ),
  step((tx) => tx.end({ winner: alive(tx)[0] ?? null })),
);

export const duel = rules({
  players: [2, 3],
  setup,
  abilities: [shield, thorns, bomb],
  flow,
});
