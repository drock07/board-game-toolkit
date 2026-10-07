// The effects reference's sample: a carried ability on "enters", a
// game-wide ability that always asks, and an effect only one player sees.
import {
  defaultNodes,
  define,
  entity,
  zone,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

interface Vars {
  hp: Record<PlayerId, number>;
}

export const card = entity<{ name: "Trap" | "Potion" | "Coin" }>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
export const discard = zone("discard", { holds: card });

const { rules, action, effect, ability, seq, step, turns, prompt } =
  define<Vars>({ zones: [deck, hand, discard] }).withNodes(defaultNodes);

// #region effects
/** Damage to one player. */
export const strike = effect<{ target: PlayerId; damage: number }>("strike", {
  resolve: (tx, s) => void (tx.vars.hp[s.target]! -= s.damage),
});

/** What a player drew: only they see it in their events. */
export const drew = effect<{ player: PlayerId; name: string }>("drew", {
  to: (d) => [d.player],
});
// #endregion effects

// #region trap
// Carried: a Trap goes off when it arrives in a hand, by any route
const trap = ability({
  of: card,
  where: (c) => c.props.name === "Trap",
  in: hand,
  on: "enters",
  then: (t) =>
    step((tx) => tx.cause(strike, { target: t.owner(tx)!, damage: 3 })),
});
// #endregion trap

// #region dodge
// Game-wide: always asks the target, so asking reveals nothing about hands
const dodge = ability({
  on: strike.before,
  who: (_s, d) => d.target,
  then: (t) =>
    prompt(
      { label: "Drink a potion?" },
      action("drink", {
        validate: (s, actor) =>
          s.entities(hand.of(actor)).some((c) => c.props.name === "Potion")
            ? true
            : "You have no potion",
        execute(tx, actor) {
          const potion = tx
            .entities(hand.of(actor))
            .find((c) => c.props.name === "Potion")!;
          tx.move(potion.id, discard);
          t.data(tx).damage = 0; // the strike resolves with this
        },
      }),
      action("endure", { execute: () => {} }),
    ),
});
// #endregion dodge

// #region rules
export const draw = action("draw", {
  execute(tx, actor) {
    const top = tx.entities(deck)[0]!;
    tx.move(top.id, hand.of(actor));
    tx.cause(drew, { player: actor, name: top.props.name });
  },
});

export const ambush = rules({
  players: 2,
  setup(tx) {
    tx.vars = { hp: Object.fromEntries(tx.players.map((p) => [p, 10])) };
    // Created at the bottom, so the deck's top is the first one listed
    for (const name of ["Potion", "Coin", "Trap", "Coin"] as const)
      tx.create(card, { name }, deck);
  },
  abilities: [trap, dodge],
  flow: seq(
    turns(
      { until: (s) => s.count(deck) === 0 },
      prompt({ label: "Draw a card" }, draw),
    ),
    step((tx) => tx.end(tx.vars.hp)),
  ),
});
// #endregion rules
