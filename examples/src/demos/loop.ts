// A loop: repeats its body until `until` holds (forever without it). Here
// three rounds of a bet, then a summary.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, seq, step, prompt } = define<{
  round: number;
  score: number;
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { round: 0, score: 0 }),
  flow: loop(
    {},
    seq(
      step((tx) => void (tx.vars = { round: 0, score: 0 })),
      loop(
        { until: (s) => s.vars.round === 3 },
        seq(
          step((tx) => void tx.vars.round++),
          prompt(
            { label: "Bet" },
            action("low", { execute: (tx) => void (tx.vars.score += 1) }),
            action("high", {
              execute: (tx) => void (tx.vars.score += tx.random.int(3)),
            }),
          ),
        ),
      ),
      prompt({ label: "Play again" }, action("again", { execute: () => {} })),
    ),
  ),
});
// #endregion game
