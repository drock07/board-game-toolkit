// A step: runs rules code in one transaction, without waiting. Here a step
// rolls two dice; the prompt waits before rolling again.
import { D6, defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, seq, step, prompt } = define<{
  dice: number[];
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { dice: [] }),
  flow: loop(
    {},
    seq(
      step((tx) => {
        tx.vars.dice = [tx.random.roll(D6), tx.random.roll(D6)];
      }),
      prompt({ label: "Roll again" }, action("again", { execute: () => {} })),
    ),
  ),
});
// #endregion game
