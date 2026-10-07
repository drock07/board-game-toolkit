// The Boards guide's sample: a tile-drafting game in the style of Azul.
// Factories are a counted zone family sized by the player count, and each
// player has five pattern lines, a family that's both per player and counted.
import {
  defaultNodes,
  define,
  entity,
  zone,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

export const COLORS = ["blue", "red", "black"] as const;
export const tile = entity<{ color: (typeof COLORS)[number] }>("tile");

// #region zones
export const bag = zone("bag", { holds: tile, visibility: "hidden" });
// 2 players: 5 factories; 3 players: 7; 4 players: 9
export const factory = zone("factory", {
  holds: tile,
  count: (players) => 2 * players + 1,
});
// Five lines each: line.of("ann", 0) … line.of("ann", 4)
export const line = zone("line", { holds: tile, perPlayer: true, count: 5 });
// #endregion zones

interface Vars {
  taken: Record<PlayerId, number>;
}

const { rules, action, seq, step, turns, prompt } = define<Vars>({
  zones: [bag, factory, line],
}).withNodes(defaultNodes);

// #region take
const LINES = [0, 1, 2, 3, 4];

export const take = action("take", {
  // Every non-empty factory, into any of the actor's lines
  enumerate: (s) =>
    s
      .zones(factory)
      .map((_, i) => i)
      .filter((i) => s.count(factory.at(i)) > 0)
      .flatMap((i) => LINES.map((l) => ({ factory: i, line: l }))),
  validate: (s, { factory: i, line: l }) =>
    i >= 0 && i < s.zones(factory).length && s.count(factory.at(i)) > 0
      ? LINES.includes(l)
        ? true
        : "No such line"
      : "Take from a factory with tiles",
  execute(tx, { factory: i, line: l }, actor) {
    const tiles = tx.entities(factory.at(i)).map((t) => t.id);
    tx.move(tiles, line.of(actor, l));
    tx.vars.taken[actor]! += tiles.length;
  },
});
// #endregion take

export const market = rules({
  players: [2, 4],
  setup(tx) {
    tx.vars = { taken: Object.fromEntries(tx.players.map((p) => [p, 0])) };
    for (const color of COLORS)
      for (let i = 0; i < 12; i++) tx.create(tile, { color }, bag);
  },
  flow: seq(
    // #region fill
    step((tx) => {
      tx.shuffle(bag);
      // Every factory in the family, in index order
      for (const f of tx.zones(factory)) tx.moveTop(bag, f, 4);
    }),
    // #endregion fill
    turns(
      { until: (s) => s.zones(factory).every((f) => s.count(f) === 0) },
      prompt({ label: "Take a factory" }, take),
    ),
    step((tx) => tx.end(tx.vars.taken)),
  ),
});
