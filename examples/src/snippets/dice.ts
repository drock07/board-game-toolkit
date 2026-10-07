// The Dice guide's custom dice: a die is its list of faces, and a roll is
// typed by them. A tiny game rolls three of them.
import {
  defaultNodes,
  define,
  type Die,
} from "@drock07/board-game-toolkit-engine";

// #region dice
// Faces may repeat: two of six are "hit", so a hit comes up a third of the time
export const combatDie = {
  faces: ["hit", "hit", "miss", "miss", "crit", "shield"],
} as const satisfies Die<string>;

// Faces may be any JSON: here, how much of each resource a face yields
export type Yield = { wood: number; stone: number };
export const resourceDie: Die<Yield> = {
  faces: [
    { wood: 1, stone: 0 },
    { wood: 2, stone: 0 },
    { wood: 0, stone: 1 },
    { wood: 1, stone: 1 },
    { wood: 0, stone: 0 },
    { wood: 0, stone: 0 },
  ],
};

export type CombatFace = (typeof combatDie.faces)[number];
// #endregion dice

interface Vars {
  rolled: CombatFace[];
  wood: number;
}

const { rules, action, loop, prompt } = define<Vars>().withNodes(defaultNodes);

// #region roll
export const attack = action("attack", {
  execute(tx) {
    // Each roll is a CombatFace: "hit" | "miss" | "crit" | "shield"
    tx.vars.rolled = [1, 2, 3].map(() => tx.random.roll(combatDie));
    tx.vars.wood += tx.random.roll(resourceDie).wood; // a Yield
  },
});
// #endregion roll

export const skirmish = rules({
  players: 1,
  setup(tx) {
    tx.vars = { rolled: [], wood: 0 };
  },
  flow: loop({}, prompt({ label: "Attack" }, attack)),
});
