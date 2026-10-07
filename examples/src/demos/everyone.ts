// Everyone: each player answers once, in any order, and the node ends when
// all have. Here both players pick a number; the higher pick scores.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

interface Vars {
  picks: Record<string, number>;
  score: Record<string, number>;
}

const { rules, action, loop, seq, step, everyone } =
  define<Vars>().withNodes(defaultNodes);

// #region game
const pick = action("pick", {
  enumerate: () => [1, 2, 3].map((n) => ({ n })),
  execute: (tx, { n }, actor) => void (tx.vars.picks[actor] = n),
});

export const game = rules({
  players: 2,
  setup: (tx) =>
    void (tx.vars = {
      picks: {},
      score: Object.fromEntries(tx.players.map((p) => [p, 0])),
    }),
  flow: loop(
    {},
    seq(
      step((tx) => void (tx.vars.picks = {})),
      everyone({ label: "Pick a number" }, pick),
      step((tx) => {
        const [a, b] = tx.players.map((p) => tx.vars.picks[p] ?? 0);
        if (a! > b!) tx.vars.score[tx.players[0]!]!++;
        if (b! > a!) tx.vars.score[tx.players[1]!]!++;
      }),
    ),
  ),
});
// #endregion game
