// A branch: runs the first case whose condition holds, or `otherwise`.
// Here a roll decides between two prompts.
import { D6, defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, seq, step, branch, prompt } = define<{
  roll: number;
  gold: number;
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { roll: 0, gold: 0 }),
  flow: loop(
    {},
    seq(
      step((tx) => void (tx.vars.roll = tx.random.roll(D6))),
      branch(
        [
          {
            when: (s) => s.vars.roll >= 5,
            then: prompt(
              { label: "Treasure!" },
              action("take", { execute: (tx) => void (tx.vars.gold += 3) }),
            ),
          },
        ],
        prompt(
          { label: "Nothing here" },
          action("move", { execute: () => {} }),
        ),
      ),
    ),
  ),
});
// #endregion game
