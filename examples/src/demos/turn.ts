// A turn: holds one prompt open across several answers. Here you must draw
// first, may draw twice, may discard any number of times, and end when
// you pass.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, turn } = define<{
  hand: number;
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { hand: 0 }),
  flow: loop(
    {},
    turn(
      { label: "Your turn", first: ["draw"], limits: { draw: 2 } },
      action("draw", { execute: (tx) => void tx.vars.hand++ }),
      action("discard", {
        validate: (s) => (s.vars.hand > 0 ? true : "Nothing to discard"),
        execute: (tx) => void tx.vars.hand--,
      }),
      // Returning "end" ends the turn; the loop starts a fresh one
      action("pass", { execute: () => "end" }),
    ),
  ),
});
// #endregion game
