// Anyone: waits for the first answer from any of `who` (everyone by
// default). Here a coin lands and whoever grabs it first scores.
import { defaultNodes, define } from "@drock07/board-game-toolkit-engine";

const { rules, action, loop, anyone } = define<{
  coins: Record<string, number>;
}>().withNodes(defaultNodes);

// #region game
export const game = rules({
  players: 3,
  setup: (tx) =>
    void (tx.vars = {
      coins: Object.fromEntries(tx.players.map((p) => [p, 0])),
    }),
  flow: loop(
    {},
    anyone(
      { label: "Grab the coin!" },
      action("grab", {
        execute: (tx, actor) => void tx.vars.coins[actor]!++,
      }),
    ),
  ),
});
// #endregion game
