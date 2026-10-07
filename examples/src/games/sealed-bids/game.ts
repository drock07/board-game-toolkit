import {
  defaultNodes,
  define,
  entity,
  zone,
  type DeepReadonly,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

export const STARTING_COINS = 10;

export interface Item {
  name: string;
  value: number;
}

export const ITEMS: Item[] = [
  { name: "Crown", value: 10 },
  { name: "Gem", value: 7 },
  { name: "Scepter", value: 5 },
];

// #region types
export interface Vars {
  coins: Record<PlayerId, number>;
  /** Items still to auction, next first. */
  items: Item[];
  /** The item up for auction this round. */
  lot: Item | null;
  won: Record<PlayerId, Item[]>;
  lastResult: Sale | null;
  /** Set after the last round: the players with the most points. */
  winners: PlayerId[];
}

export interface Sale {
  winner: PlayerId;
  item: Item;
  paid: number;
}
// #endregion types

// #region box
// A sealed bid is an entity in its bidder's own zone: only they can see it
export interface Bid {
  amount: number;
}
export const bid = entity<Bid>("bid");
export const sealed = zone("sealed", {
  holds: bid,
  perPlayer: true,
  visibility: "owner",
});
// #endregion box

const perPlayer = <T>(players: readonly PlayerId[], value: () => T) =>
  Object.fromEntries(players.map((p) => [p, value()])) as Record<PlayerId, T>;

/** Points: the value of items won plus coins left. */
export const points = (
  vars: DeepReadonly<Pick<Vars, "coins" | "won">>,
  player: PlayerId,
) =>
  (vars.coins[player] ?? 0) +
  (vars.won[player] ?? []).reduce((sum, item) => sum + item.value, 0);

const { rules, action, effect, loop, seq, step, everyone, prompt } =
  define<Vars>({ zones: [sealed] }).withNodes(defaultNodes);

/** A lot was sold. The page gives each result a moment on screen. */
export const sold = effect<Sale>("sold");

// #region placeBid
export const placeBid = action("placeBid", {
  enumerate: (s, actor) =>
    Array.from({ length: (s.vars.coins[actor] ?? 0) + 1 }, (_, amount) => ({
      amount,
    })),
  validate: (s, { amount }, actor) => {
    const coins = s.vars.coins[actor] ?? 0;
    return Number.isInteger(amount) && amount >= 0 && amount <= coins
      ? true
      : `Bid a whole amount from 0 to ${coins}`;
  },
  execute(tx, { amount }, actor) {
    tx.create(bid, { amount }, sealed.of(actor));
  },
});
// #endregion placeBid

export const again = action("again", { execute: () => {} });

// #region rules
export const sealedBids = rules({
  players: [2, 5],
  setup(tx) {
    tx.vars = {
      coins: perPlayer(tx.players, () => STARTING_COINS),
      items: [],
      lot: null,
      won: perPlayer(tx.players, () => []),
      lastResult: null,
      winners: [],
    };
  },
  // Games repeat forever: three lots, scores, then wait to play again
  flow: loop(
    {},
    seq(
      step((tx) => {
        tx.vars.coins = perPlayer(tx.players, () => STARTING_COINS);
        tx.vars.won = perPlayer(tx.players, () => []);
        tx.vars.items = tx.random.shuffle(ITEMS);
        tx.vars.lastResult = null;
        tx.vars.winners = [];
      }),
      // #region round
      loop(
        { until: (s) => s.vars.items.length === 0 },
        seq(
          step((tx) => {
            // Last round's bids are discarded unseen
            for (const p of tx.players)
              for (const b of tx.entities(sealed.of(p))) tx.destroy(b.id);
            tx.vars.lot = tx.vars.items.shift() ?? null;
          }),
          // Everyone bids at once, each on their own prompt, in any order
          everyone({ label: "Place a sealed bid" }, placeBid),
          step((tx) => {
            // Highest bid wins; ties go to the earlier seat
            const amount = (p: PlayerId) =>
              tx.entities(sealed.of(p))[0]?.props.amount ?? 0;
            const winner = tx.players.reduce((best, p) =>
              amount(p) > amount(best) ? p : best,
            );
            const paid = amount(winner);
            const item = tx.vars.lot!;
            tx.vars.coins[winner]! -= paid;
            tx.vars.won[winner]!.push(item);
            tx.vars.lastResult = { winner, item, paid };
            tx.vars.lot = null;
            tx.cause(sold, { winner, item, paid });
          }),
        ),
      ),
      // #endregion round
      step((tx) => {
        const best = Math.max(...tx.players.map((p) => points(tx.vars, p)));
        tx.vars.winners = tx.players.filter((p) => points(tx.vars, p) === best);
      }),
      prompt({ label: "Play again" }, again),
    ),
  ),
});
// #endregion rules
