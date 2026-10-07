// Turns: each player in seat order takes the body as their turn. Here two
// rounds of three players adding to a pot, then a summary.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, seq, step, turns, prompt } = define<{
  pot: number;
}>().withNodes(defaultNodes);

const add = action("add", {
  enumerate: () => [{ n: 1 }, { n: 2 }, { n: 3 }],
  execute: (tx, { n }) => void (tx.vars.pot += n),
});

// #region game
export const game = rules({
  players: 3,
  setup: (tx) => void (tx.vars = { pot: 0 }),
  flow: loop(
    {},
    seq(
      step((tx) => void (tx.vars.pot = 0)),
      // `turnsNode.shown(view)` tells a UI whose turn, which turn and round
      turns({ rounds: 2 }, prompt({ label: "Add to the pot" }, add)),
      prompt({ label: "Play again" }, action("again", { execute: () => {} })),
    ),
  ),
});
// #endregion game
