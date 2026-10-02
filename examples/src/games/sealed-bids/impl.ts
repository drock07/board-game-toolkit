import type {
  DeepReadonly,
  GameImpl,
  PlayerId,
  TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

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

export interface Vars {
  coins: Record<PlayerId, number>;
  /** This round's bids; null until a player has bid. */
  bids: Record<PlayerId, number | null>;
  /** Items still to auction, next first. */
  items: Item[];
  /** The item up for auction this round. */
  lot: Item | null;
  won: Record<PlayerId, Item[]>;
  lastResult: { winner: PlayerId; item: Item; paid: number } | null;
  /** Set after the last round: the players with the most points. */
  winners: PlayerId[];
}

export type Types = TypesFor<typeof spec, { vars: Vars }>;

export type BidArgs = { amount: number };

const perPlayer = <T>(players: readonly PlayerId[], value: () => T) =>
  Object.fromEntries(players.map((p) => [p, value()])) as Record<PlayerId, T>;

/** Points: the value of items won plus coins left. */
export const points = (
  vars: DeepReadonly<Pick<Vars, "coins" | "won">>,
  player: PlayerId,
) =>
  (vars.coins[player] ?? 0) +
  (vars.won[player] ?? []).reduce((sum, item) => sum + item.value, 0);

export const impl = {
  setup(tx) {
    const { players } = tx.state;
    tx.vars = {
      coins: perPlayer(players, () => STARTING_COINS),
      bids: perPlayer(players, () => null),
      items: [],
      lot: null,
      won: perPlayer(players, () => []),
      lastResult: null,
      winners: [],
    };
  },
  steps: {
    newGame(tx) {
      const { players } = tx.state;
      tx.vars.coins = perPlayer(players, () => STARTING_COINS);
      tx.vars.won = perPlayer(players, () => []);
      tx.vars.items = tx.random.shuffle(ITEMS);
      tx.vars.lastResult = null;
      tx.vars.winners = [];
    },
    offerNextItem(tx) {
      tx.vars.lot = tx.vars.items.shift() ?? null;
      tx.vars.bids = perPlayer(tx.state.players, () => null);
    },
    resolveBids(tx) {
      // Highest bid wins; ties go to the earlier seat
      const { players } = tx.state;
      const winner = players.reduce((best, p) =>
        (tx.vars.bids[p] ?? 0) > (tx.vars.bids[best] ?? 0) ? p : best,
      );
      const paid = tx.vars.bids[winner] ?? 0;
      const item = tx.vars.lot!;
      tx.vars.coins[winner]! -= paid;
      tx.vars.won[winner]!.push(item);
      tx.vars.lastResult = { winner, item, paid };
      tx.vars.lot = null;
    },
    finalScores(tx) {
      const { players } = tx.state;
      const best = Math.max(...players.map((p) => points(tx.vars, p)));
      tx.vars.winners = players.filter((p) => points(tx.vars, p) === best);
    },
  },
  actions: {
    // #region placeBid
    placeBid: {
      enumerate: (s, scope): BidArgs[] =>
        Array.from(
          { length: (s.vars.coins[scope.actor!] ?? 0) + 1 },
          (_, amount) => ({
            amount,
          }),
        ),
      validate: (s, { amount }: BidArgs, scope) => {
        const coins = s.vars.coins[scope.actor!] ?? 0;
        return Number.isInteger(amount) && amount >= 0 && amount <= coins
          ? true
          : `Bid a whole amount from 0 to ${coins}`;
      },
      execute(tx, { amount }: BidArgs) {
        tx.vars.bids[tx.scope.actor!] = amount;
      },
    },
    // #endregion placeBid
  },
} satisfies GameImpl<Types>;
