// A prompt: waits for the current player to take one of its actions. An
// action's args are what `enumerate` lists, and `validate` rules them in or
// out. Here you paint a square; a color can't be used twice in a row.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const COLORS = ["red", "green", "blue"] as const;

const { rules, action, loop, prompt } = define<{
  squares: string[];
}>().withNodes(defaultNodes);

// #region game
const paint = action("paint", {
  enumerate: () => COLORS.map((color) => ({ color })),
  validate: (s, { color }) =>
    s.vars.squares.at(-1) === color ? "Pick a different color" : true,
  execute: (tx, { color }) => void tx.vars.squares.push(color),
});

export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { squares: [] }),
  flow: loop({}, prompt({ label: "Paint a square" }, paint)),
});
// #endregion game
