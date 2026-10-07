// The turns reference's sample: every option at once. Players knock each
// other out; the dealer goes first and knocked-out players are skipped.
import {
  defaultNodes,
  define,
  type PlayerId,
  type Reader,
} from "@drock07/board-game-toolkit-engine";

interface Vars {
  dealer: PlayerId;
  out: PlayerId[];
}

const { rules, action, seq, step, turns, prompt } =
  define<Vars>().withNodes(defaultNodes);

const standing = (s: Pick<Reader<Vars>, "players" | "vars">) =>
  s.players.filter((p) => !s.vars.out.includes(p));

export const knock = action("knock", {
  enumerate: (s, actor) =>
    standing(s)
      .filter((p) => p !== actor)
      .map((target) => ({ target })),
  execute: (tx, { target }) => void tx.vars.out.push(target),
});
export const wait = action("wait", { execute: () => {} });

// #region turns
export const knockout = rules({
  players: [2, 6],
  setup: (tx) => void (tx.vars = { dealer: tx.players.at(-1)!, out: [] }),
  flow: seq(
    turns(
      {
        // The dealer goes first, then play carries on in seat order
        from: (s) => s.vars.dealer,
        // Knocked-out players are skipped
        among: (s) => standing(s),
        // Checked before every turn
        until: (s) => standing(s).length === 1,
        // At most three times around the table
        rounds: 3,
      },
      prompt({ label: "Knock someone out" }, knock, wait),
    ),
    step((tx) => tx.end({ standing: standing(tx) })),
  ),
});
// #endregion turns
