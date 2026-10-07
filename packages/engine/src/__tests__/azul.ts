// Azul. Two to four players draft tiles from factories and the center into
// pattern lines; full lines tile the wall at the end of each round and
// score by adjacency. Floor tiles cost points. The game ends after a round
// in which someone completes a wall row.
import type { EntityId, PlayerId } from "../index.js";
import {
  defaultNodes,
  define,
  entity,
  zone,
  type Reader,
  type Tx,
  type ZoneRef,
} from "../index.js";

export const COLORS = ["blue", "yellow", "red", "black", "white"] as const;
export type Color = (typeof COLORS)[number];

export interface Tile {
  color: Color;
}

export interface Vars {
  score: Record<PlayerId, number>;
  /** Who holds the first-player marker: the center, or a player who drafted from it. */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- documents the sentinel
  marker: "center" | PlayerId;
  /** Who starts the next round: last round's marker taker. */
  starter: PlayerId;
}

// The box
export const tile = entity<Tile>("tile");
export const bag = zone("bag", { holds: tile, visibility: "hidden" });
export const lid = zone("lid", { holds: tile });
export const center = zone("center", { holds: tile });
export const factory = zone("factory", {
  holds: tile,
  count: (players) => 2 * players + 1,
});
export const line = zone("line", { holds: tile, perPlayer: true, count: 5 });
export const wall = zone("wall", { holds: tile, perPlayer: true, count: 5 });
export const floor = zone("floor", { holds: tile, perPlayer: true });

const { rules, action, seq, step, turns, loop, prompt } = define<Vars>({
  zones: [bag, lid, center, factory, line, wall, floor],
}).withNodes(defaultNodes);

const FLOOR_PENALTY = [1, 1, 2, 2, 2, 3, 3];
const TILES_PER_COLOR = 20;
const TILES_PER_FACTORY = 4;

/** The wall column a color lands in on a row. */
export const columnOf = (row: number, color: Color) =>
  (row + COLORS.indexOf(color)) % 5;
const colorAt = (row: number, col: number) => COLORS[(col - row + 5) % 5]!;

/** Anything that can read zones: a reader or a transaction. */
type S = Pick<
  Reader<Vars>,
  "entities" | "count" | "zones" | "players" | "vars"
>;

const colorsIn = (s: S, z: ZoneRef<Tile>) => [
  ...new Set(s.entities(z).map((t) => t.props.color)),
];
const wallHas = (s: S, p: PlayerId, row: number, color: Color) =>
  s.entities(wall.of(p, row)).some((t) => t.props.color === color);

/** Pattern lines a player may put `color` tiles in: empty or same color, not full, and the wall row lacks the color. */
function openLines(s: S, p: PlayerId, color: Color): number[] {
  const out: number[] = [];
  for (let row = 0; row < 5; row++) {
    const tiles = s.entities(line.of(p, row));
    const sameColor = tiles.length === 0 || tiles[0]!.props.color === color;
    if (sameColor && tiles.length < row + 1 && !wallHas(s, p, row, color))
      out.push(row);
  }
  return out;
}

/** Points for placing a tile at (row, col): the runs it joins, or 1 alone. */
export function placementScore(
  filled: (row: number, col: number) => boolean,
  row: number,
  col: number,
): number {
  const run = (dr: number, dc: number) => {
    let n = 0;
    for (
      let r = row + dr, c = col + dc;
      r >= 0 && r < 5 && c >= 0 && c < 5 && filled(r, c);
      r += dr, c += dc
    )
      n++;
    return n;
  };
  const horizontal = run(0, -1) + run(0, 1);
  const vertical = run(-1, 0) + run(1, 0);
  if (horizontal === 0 && vertical === 0) return 1;
  return (horizontal ? horizontal + 1 : 0) + (vertical ? vertical + 1 : 0);
}

/** Draws from the bag, refilling it from the lid when empty. Stops when both are empty. */
function fillFactories(tx: Tx<Vars>) {
  for (const f of tx.zones(factory)) {
    for (let i = 0; i < TILES_PER_FACTORY; i++) {
      if (tx.count(bag) === 0) {
        if (tx.count(lid) === 0) return;
        tx.move(
          tx.entities(lid).map((t) => t.id),
          bag,
        );
        tx.shuffle(bag);
      }
      tx.moveTop(bag, f);
    }
  }
}

const offerEmpty = (s: S) =>
  s.count(center) === 0 && s.zones(factory).every((f) => s.count(f) === 0);
const rowComplete = (s: S) =>
  s.players.some((p) => s.zones(wall, p).some((w) => s.count(w) === 5));

export const azul = rules({
  players: [2, 4],
  setup: (tx) => {
    tx.vars = {
      score: Object.fromEntries(tx.players.map((p) => [p, 0])),
      marker: "center",
      starter: tx.players[0]!,
    };
    for (const color of COLORS)
      for (let i = 0; i < TILES_PER_COLOR; i++) tx.create(tile, { color }, bag);
    tx.shuffle(bag);
  },
  flow: seq(
    loop(
      { until: rowComplete },
      seq(
        step(fillFactories),
        turns(
          { until: offerEmpty, from: (s) => s.vars.starter },
          prompt(
            action("draft", {
              /** Every (source, color, destination) a player could pick. */
              enumerate: (s, actor) => {
                const sources = [center, ...s.zones(factory)].filter(
                  (z) => s.count(z) > 0,
                );
                return sources.flatMap((source) =>
                  colorsIn(s, source).flatMap((color) =>
                    [...openLines(s, actor, color), "floor" as const].map(
                      (to) => ({ from: source, color, to }),
                    ),
                  ),
                );
              },
              execute: (tx, { from, color, to }, actor) => {
                const taken = tx
                  .entities(from)
                  .filter((t) => t.props.color === color)
                  .map((t) => t.id);
                const rest = tx
                  .entities(from)
                  .filter((t) => t.props.color !== color)
                  .map((t) => t.id);
                if (from.id === center.id) {
                  if (tx.vars.marker === "center") tx.vars.marker = actor;
                } else {
                  tx.move(rest, center);
                }
                let overflow = taken;
                if (to !== "floor") {
                  const room = to + 1 - tx.count(line.of(actor, to));
                  tx.move(taken.slice(0, room), line.of(actor, to));
                  overflow = taken.slice(room);
                }
                const floorRoom =
                  FLOOR_PENALTY.length - tx.count(floor.of(actor));
                tx.move(overflow.slice(0, floorRoom), floor.of(actor));
                tx.move(overflow.slice(floorRoom), lid);
              },
            }),
          ),
        ),
        step((tx) => {
          // Wall tiling: full lines place one tile and score; the rest go to the lid
          for (const p of tx.players) {
            const filled = (row: number, col: number) =>
              wallHas(tx, p, row, colorAt(row, col));
            for (let row = 0; row < 5; row++) {
              const tiles = tx.entities(line.of(p, row));
              if (tiles.length < row + 1) continue;
              const [first, ...rest] = tiles.map((t) => t.id) as [
                EntityId,
                ...EntityId[],
              ];
              tx.move(first, wall.of(p, row));
              tx.move(rest, lid);
              tx.vars.score[p]! += placementScore(
                filled,
                row,
                columnOf(row, tiles[0]!.props.color),
              );
            }
            // Floor penalties, counting the marker as a floor tile
            const onFloor =
              tx.count(floor.of(p)) + (tx.vars.marker === p ? 1 : 0);
            const penalty = FLOOR_PENALTY.slice(0, onFloor).reduce(
              (a, b) => a + b,
              0,
            );
            tx.vars.score[p] = Math.max(0, tx.vars.score[p]! - penalty);
            tx.move(
              tx.entities(floor.of(p)).map((t) => t.id),
              lid,
            );
          }
          if (tx.vars.marker !== "center") tx.vars.starter = tx.vars.marker;
          tx.vars.marker = "center";
        }),
      ),
    ),
    step((tx) => {
      // End bonuses: 2 per full row, 7 per full column, 10 per complete color
      for (const p of tx.players) {
        const has = (row: number, col: number) =>
          wallHas(tx, p, row, colorAt(row, col));
        let bonus = 0;
        for (let i = 0; i < 5; i++) {
          if ([0, 1, 2, 3, 4].every((c) => has(i, c))) bonus += 2;
          if ([0, 1, 2, 3, 4].every((r) => has(r, i))) bonus += 7;
          if ([0, 1, 2, 3, 4].every((r) => wallHas(tx, p, r, COLORS[i]!)))
            bonus += 10;
        }
        tx.vars.score[p]! += bonus;
      }
      const best = Math.max(...Object.values(tx.vars.score));
      tx.end({
        winners: tx.players.filter((p) => tx.vars.score[p] === best),
        score: tx.vars.score,
      });
    }),
  ),
});
