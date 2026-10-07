// The Hidden information guide's reaction sample: a Counter card in a hidden
// hand. Written as an ability the card carries, it gives itself away: its
// owner is asked to respond only when they hold one. Written as a game-wide
// ability that always asks the target, it doesn't.
import {
  defaultNodes,
  define,
  entity,
  zone,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

export const card = entity<{ name: "Counter" | "Dud" }>("card");
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});

interface Vars {
  hits: Record<PlayerId, number>;
  countered: boolean;
}

/** One game per style: the abilities differ, the rest is the same. */
function duel(style: "carried" | "asks") {
  const { rules, action, effect, ability, loop, turns, prompt } = define<Vars>({
    zones: [hand],
  }).withNodes(defaultNodes);

  const attack = effect<{ target: PlayerId }>("attack", {
    resolve(tx, { target }) {
      if (!tx.vars.countered) tx.vars.hits[target]!++;
      tx.vars.countered = false;
    },
  });
  const strike = action("strike", {
    execute(tx, actor) {
      const next = tx.players[(tx.players.indexOf(actor) + 1) % 2]!;
      tx.cause(attack, { target: next });
    },
  });
  const counter = action("counter", {
    validate: (s, actor) =>
      s.entities(hand.of(actor)).some((c) => c.props.name === "Counter")
        ? true
        : "You have no Counter",
    execute(tx) {
      tx.vars.countered = true;
    },
  });
  const takeIt = action("takeIt", { execute: () => {} });

  // #region carried
  // Leaks: only a player holding a Counter is ever asked
  const carried = ability({
    of: card,
    where: (c) => c.props.name === "Counter",
    in: hand,
    on: attack.before,
    when: (_s, t) => t.owner === t.data.target,
    then: () => prompt({ label: "Respond to the attack" }, counter, takeIt),
  });
  // #endregion carried

  // #region asks
  // Safe: the target is always asked, and validate checks the hand
  const asks = ability({
    on: attack.before,
    who: (_s, a) => a.target,
    then: () => prompt({ label: "Respond to the attack" }, counter, takeIt),
  });
  // #endregion asks

  return rules({
    players: 2,
    setup(tx) {
      tx.vars = {
        hits: Object.fromEntries(tx.players.map((p) => [p, 0])),
        countered: false,
      };
      // The second seat holds the Counter
      tx.players.forEach((p, i) =>
        tx.create(card, { name: i === 1 ? "Counter" : "Dud" }, hand.of(p)),
      );
    },
    abilities: [style === "carried" ? carried : asks],
    flow: loop({}, turns({}, prompt({ label: "Strike" }, strike))),
  });
}

export const leaky = duel("carried");
export const safe = duel("asks");
