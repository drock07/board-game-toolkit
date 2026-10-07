// The reusing flow guide's game: two auctions, each built by one function,
// with one scoring step shared as a constant.
import {
  defaultNodes,
  define,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

export interface Vars {
  bids: Record<PlayerId, number>;
  won: Record<PlayerId, string[]>;
  log: string[];
}

const { rules, action, everyone, seq, step } =
  define<Vars>().withNodes(defaultNodes);

export const bid = action("bid", {
  enumerate: () => [0, 1, 2, 3].map((amount) => ({ amount })),
  execute: (tx, { amount }, actor) => void (tx.vars.bids[actor] = amount),
});

// #region pieces
/** A piece used as is: a node is a value, so a constant can go anywhere. */
const tally = step((tx) => void tx.vars.log.push("tallied"));

/** A piece with parameters: a function that returns a node. */
const auction = (lot: string) =>
  seq(
    step((tx) => void (tx.vars.bids = {})),
    everyone({ label: `Bid for the ${lot}` }, bid),
    step((tx) => {
      const best = tx.players.reduce((a, b) =>
        (tx.vars.bids[b] ?? 0) > (tx.vars.bids[a] ?? 0) ? b : a,
      );
      tx.vars.won[best]!.push(lot);
    }),
    tally,
  );

export const twoLots = rules({
  players: 2,
  setup: (tx) =>
    void (tx.vars = {
      bids: {},
      won: Object.fromEntries(tx.players.map((p) => [p, []])),
      log: [],
    }),
  flow: seq(
    auction("Crown"),
    auction("Gem"),
    step((tx) => tx.end(tx.vars.won)),
  ),
});
// #endregion pieces
