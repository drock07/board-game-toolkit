// Sealed Bids. Three items are auctioned; every player bids at once, in
// secret; the highest bid wins the item and pays. Most points (coins left
// plus item values) wins.
import type { PlayerId } from "../index.js";
import { defaultNodes, define, entity, zone, type Reader } from "../index.js";

export const STARTING_COINS = 10;

export interface Item {
  name: string;
  value: number;
}
export interface Bid {
  amount: number;
}

export interface Vars {
  coins: Record<PlayerId, number>;
  lastResult: { winner: PlayerId; item: Item; paid: number } | null;
}

export const ITEMS: Item[] = [
  { name: "Crown", value: 10 },
  { name: "Gem", value: 7 },
  { name: "Scepter", value: 5 },
];

// The box: a sealed bid is an entity only its owner can see until it's revealed
export const item = entity<Item>("item");
export const bid = entity<Bid>("bid");
export const lots = zone("lots", { holds: item });
export const won = zone("won", { holds: item, perPlayer: true });
export const sealed = zone("sealed", {
  holds: bid,
  perPlayer: true,
  visibility: "owner",
});
export const revealed = zone("revealed", { holds: bid });

const { rules, action, seq, step, loop, everyone } = define<Vars>({
  zones: [lots, won, sealed, revealed],
}).withNodes(defaultNodes);

/** Points: coins left plus the value of items won. */
export const points = (
  s: Pick<Reader<Vars>, "vars" | "entities">,
  p: PlayerId,
) =>
  (s.vars.coins[p] ?? 0) +
  s.entities(won.of(p)).reduce((n, i) => n + i.props.value, 0);

export const sealedBids = rules({
  players: [2, 5],
  setup: (tx) => {
    tx.vars = {
      coins: Object.fromEntries(tx.players.map((p) => [p, STARTING_COINS])),
      lastResult: null,
    };
    for (const i of ITEMS) tx.create(item, i, lots);
    tx.shuffle(lots);
  },
  flow: seq(
    loop(
      { until: (s) => s.count(lots) === 0 },
      seq(
        everyone(
          action("bid", {
            enumerate: (s, actor) =>
              Array.from(
                { length: (s.vars.coins[actor] ?? 0) + 1 },
                (_, amount) => ({ amount }),
              ),
            execute: (tx, { amount }, actor) => {
              tx.create(bid, { amount }, sealed.of(actor));
            },
          }),
        ),
        step((tx) => {
          // Reveal: last round's bids go, this round's become public
          for (const b of tx.entities(revealed)) tx.destroy(b.id);
          const bids = tx.players.map((p) => ({
            player: p,
            bid: tx.entities(sealed.of(p))[0]!,
          }));
          // Highest bid wins; ties go to the earlier seat
          const best = bids.reduce((a, b) =>
            b.bid.props.amount > a.bid.props.amount ? b : a,
          );
          const [lot] = tx.moveTop(lots, won.of(best.player));
          tx.vars.coins[best.player]! -= best.bid.props.amount;
          const prize = tx.entity(lot!);
          tx.vars.lastResult = {
            winner: best.player,
            item: item.is(prize) ? prize.props : { name: "?", value: 0 },
            paid: best.bid.props.amount,
          };
          tx.move(
            bids.map((b) => b.bid.id),
            revealed,
          );
        }),
      ),
    ),
    step((tx) => {
      const scores = Object.fromEntries(
        tx.players.map((p) => [p, points(tx, p)]),
      );
      const top = Math.max(...Object.values(scores));
      tx.end({ winners: tx.players.filter((p) => scores[p] === top), scores });
    }),
  ),
});
