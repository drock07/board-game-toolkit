// Outcomes: the ways a body may end early. A guard (`when`) is checked after
// every transaction; an action or step raises one by returning `{ exit }`.
// Here you push your luck: reaching 10 wins, going over 10 busts, and you
// may cash out.
import { D6, defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, seq, step, outcomes, prompt } = define<{
  total: number;
  result: string;
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { total: 0, result: "" }),
  flow: loop(
    {},
    seq(
      step((tx) => void (tx.vars = { total: 0, result: "" })),
      outcomes(
        {
          won: {
            when: (s) => s.vars.total === 10,
            then: step((tx) => void (tx.vars.result = "won")),
          },
          bust: {
            when: (s) => s.vars.total > 10,
            then: step((tx) => void (tx.vars.result = "bust")),
          },
          cashed: { then: step((tx) => void (tx.vars.result = "cashed")) },
        },
        loop(
          {},
          prompt(
            { label: "Push your luck" },
            action("roll", {
              execute: (tx) => void (tx.vars.total += tx.random.roll(D6)),
            }),
            action("cashOut", { execute: () => ({ exit: "cashed" }) }),
          ),
        ),
      ),
      prompt({ label: "Play again" }, action("again", { execute: () => {} })),
    ),
  ),
});
// #endregion game
