// Simultaneous: runs its body once per player, all at once, each on their
// own fiber. Here everyone rolls for a target at the same time, each taking
// as many rolls as they like before they stop.
import { D6, defaultNodes, define } from "@drock07/board-game-toolkit-engine";

interface Vars {
  totals: Record<string, number>;
}

const { rules, action, loop, seq, step, simultaneous, turn } =
  define<Vars>().withNodes(defaultNodes);

// #region game
const roll = action("roll", {
  validate: (s, actor) =>
    (s.vars.totals[actor] ?? 0) < 12 ? true : "You're over 12",
  execute: (tx, actor) => void (tx.vars.totals[actor]! += tx.random.roll(D6)),
});
const stop = action("stop", { execute: () => "end" });

export const game = rules({
  players: 2,
  setup: (tx) => void (tx.vars = { totals: {} }),
  flow: loop(
    {},
    seq(
      step((tx) => {
        tx.vars.totals = Object.fromEntries(tx.players.map((p) => [p, 0]));
      }),
      // Each player's turn runs on their own fiber; the round waits for both
      simultaneous(turn({ label: "Roll or stop" }, roll, stop)),
    ),
  ),
});
// #endregion game
