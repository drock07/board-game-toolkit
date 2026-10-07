// A sequence: runs its children in order, then ends. Here a round is three
// steps and a prompt, repeated.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, seq, step, prompt } = define<{
  log: string[];
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { log: [] }),
  flow: loop(
    {},
    seq(
      step((tx) => void (tx.vars.log = ["shuffle"])),
      step((tx) => void tx.vars.log.push("deal")),
      step((tx) => void tx.vars.log.push("reveal")),
      prompt({ label: "Next round" }, action("next", { execute: () => {} })),
    ),
  ),
});
// #endregion game
