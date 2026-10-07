// Effects and abilities: an effect is something that happens, in phases;
// abilities react before it resolves (and may change it) or after. Here an
// Attack hits you; a Shield in play halves it first, and Thorns in play
// strikes back afterwards.
import {
  defaultNodes,
  define,
  entity,
  zone,
} from "@drock07/board-game-toolkit-engine";

interface Vars {
  hp: number;
  enemyHp: number;
}
interface Attack {
  damage: number;
}

export const card = entity<{ name: "Shield" | "Thorns" }>("card");
const hand = zone("hand", { holds: card });
const play = zone("play", { holds: card });

const { rules, action, effect, ability, loop, step, prompt } = define<Vars>({
  zones: [hand, play],
}).withNodes(defaultNodes);

// #region game
const attack = effect<Attack>("attack", {
  resolve: (tx, a) => void (tx.vars.hp -= a.damage),
});

// Carried by a card while it's in play
const shield = ability({
  of: card,
  where: (c) => c.props.name === "Shield",
  in: play,
  on: attack.before,
  then: (t) =>
    step((tx) => void (t.data(tx).damage = Math.floor(t.data(tx).damage / 2))),
});
const thorns = ability({
  of: card,
  where: (c) => c.props.name === "Thorns",
  in: play,
  on: attack,
  then: () => step((tx) => void (tx.vars.enemyHp -= 1)),
});

const toggle = action("toggle", {
  enumerate: (s) =>
    [...s.entities(hand), ...s.entities(play)].map((c) => ({ id: c.id })),
  execute: (tx, { id }) =>
    void tx.move(id, tx.entity(id).zone === "play" ? hand : play),
});

export const game = rules({
  players: 1,
  setup: (tx) => {
    tx.vars = { hp: 20, enemyHp: 20 };
    tx.create(card, { name: "Shield" }, hand);
    tx.create(card, { name: "Thorns" }, hand);
  },
  abilities: [shield, thorns],
  flow: loop(
    {},
    prompt(
      { label: "Play or brace" },
      toggle,
      action("brace", {
        execute: (tx) => tx.cause(attack, { damage: 6 }),
      }),
    ),
  ),
});
// #endregion game
