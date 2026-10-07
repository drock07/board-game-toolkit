import { assert, test } from "vitest";
import type { State } from "../index.js";
import {
  current,
  define,
  init,
  legalInputs,
  type GameInput,
} from "../index.js";
import { applyOrThrow, fuzz, randomBot } from "../testing/index.js";
import {
  azul,
  bag,
  center,
  COLORS,
  columnOf,
  factory,
  floor,
  line,
  placementScore,
  tile,
  wall,
  type Vars,
} from "./azul.js";

const players = ["ann", "bob"];
const draft = azul.action("draft");
type Draft = Extract<GameInput<typeof azul>, { action: "draft" }>;

test("zone families lower to the spec; counts by function become refs", () => {
  assert.deepEqual(azul.spec.zones.factory, {
    holds: "tile",
    visibility: "public",
    count: { ref: "factory" },
  });
  assert.deepEqual(azul.spec.zones.line, {
    holds: "tile",
    visibility: "public",
    perPlayer: true,
    count: 5,
  });
  assert.strictEqual(azul.impl.zoneCounts.factory!(2), 5);
  assert.strictEqual(azul.impl.zoneCounts.factory!(4), 9);
  assert.deepEqual(JSON.parse(JSON.stringify(azul.spec)), azul.spec);
  assert.deepEqual(Object.keys(azul.impl.queries), ["turns.from"]);
});

test("init: five factories of four tiles for two players, lines and walls per player", () => {
  const s = init(azul, { players, seed: "a" });
  assert.deepEqual(s.zones.factory?.length, undefined);
  for (let i = 0; i < 5; i++)
    assert.strictEqual(s.zones[`factory:${i}`]!.length, 4);
  assert.strictEqual(s.zones["factory:5"], undefined);
  assert.strictEqual(s.zones[bag.id]!.length, 100 - 20);
  for (const p of players)
    for (let r = 0; r < 5; r++) {
      assert.deepEqual(s.zones[line.of(p, r).id], []);
      assert.deepEqual(s.zones[wall.of(p, r).id], []);
    }
  assert.strictEqual(current(azul, s), "ann");
  const legal = legalInputs(azul, s).filter(draft.is);
  assert.ok(legal.length > 0);
  assert.ok(
    legal.every((i) => i.args.from.id !== center.id),
    "the center is empty at first",
  );
  assert.ok(legal.some((i) => i.args.to === "floor"));
});

test("drafting from a factory moves the rest to the center; the first center draft takes the marker", () => {
  let s = init(azul, { players, seed: "a" });
  const pick = legalInputs(azul, s)
    .filter(draft.is)
    .find((i) => i.args.to === 0)!;
  const before = s.zones[pick.args.from.id]!.length;
  s = applyOrThrow(azul, s, pick);
  const taken =
    s.zones[line.of("ann", 0).id]!.length + s.zones[floor.of("ann").id]!.length;
  assert.strictEqual(s.zones[pick.args.from.id]!.length, 0);
  assert.strictEqual(s.zones[center.id]!.length, before - taken);
  assert.strictEqual(
    s.zones[line.of("ann", 0).id]!.length,
    1,
    "row 0 holds one tile",
  );
  assert.strictEqual(s.vars.marker, "center");
  assert.strictEqual(current(azul, s), "bob");
  // bob drafts from the center and takes the marker
  const fromCenter = legalInputs(azul, s)
    .filter(draft.is)
    .find((i) => i.args.from.id === center.id);
  if (fromCenter) {
    s = applyOrThrow(azul, s, fromCenter);
    assert.strictEqual(s.vars.marker, "bob");
    assert.strictEqual(current(azul, s), "ann");
    // row 0 is full for ann, so no draft offers it
    assert.ok(
      legalInputs(azul, s)
        .filter(draft.is)
        .every((i) => i.args.to !== 0),
    );
  }
});

test("placementScore: alone is 1, otherwise the runs joined", () => {
  const grid = new Set<string>();
  const filled = (r: number, c: number) => grid.has(`${r},${c}`);
  assert.strictEqual(placementScore(filled, 2, 2), 1);
  grid.add("2,1");
  assert.strictEqual(placementScore(filled, 2, 2), 2);
  grid.add("2,3").add("1,2");
  assert.strictEqual(placementScore(filled, 2, 2), 3 + 2);
  assert.strictEqual(columnOf(0, "blue"), 0);
  assert.strictEqual(columnOf(1, "blue"), 1);
  assert.strictEqual(columnOf(4, COLORS[1]), 0);
});

test("a round ends with wall tiling, scoring, and the marker's holder starting next", () => {
  let s = init(azul, { players, seed: "round" });
  const bot = randomBot("round");
  // Play one round: stop when the turns frame restarts (round 2 began) or the game ends
  const pass = (s: State<Vars>) => s.flow.find((f) => f.id === "turns")?.i ?? 0;
  let marker: string = "center";
  for (;;) {
    const before = pass(s);
    if (s.vars.marker !== "center") marker = s.vars.marker;
    s = applyOrThrow(azul, s, bot(legalInputs(azul, s)));
    if (s.status !== "running" || pass(s) < before) break;
  }
  assert.strictEqual(s.status, "running", "the seed reaches round 2");
  assert.notStrictEqual(marker, "center", "someone drafted from the center");
  assert.strictEqual(
    s.vars.marker,
    "center",
    "the marker is back in the center",
  );
  assert.strictEqual(s.vars.starter, marker, "the taker starts the next round");
  for (const p of players) {
    for (let r = 0; r < 5; r++)
      assert.ok(
        s.zones[line.of(p, r).id]!.length < r + 1,
        "no full line survives tiling",
      );
    assert.deepEqual(s.zones[floor.of(p).id], [], "floors are cleared");
    assert.ok(s.vars.score[p]! >= 0);
  }
  const onWalls = players.reduce(
    (n, p) =>
      n +
      [0, 1, 2, 3, 4].reduce(
        (m, r) => m + s.zones[wall.of(p, r).id]!.length,
        0,
      ),
    0,
  );
  assert.ok(onWalls > 0, "some tiles reached the walls");
  if (s.status === "running") {
    assert.strictEqual(
      current(azul, s),
      marker,
      "the next round starts with the marker taker",
    );
    for (let i = 0; i < 5; i++)
      assert.strictEqual(s.zones[`factory:${i}`]!.length, 4);
  }
});

test("types: family handles need their indexes", () => {
  const s = init(azul, { players, seed: "t" });
  void s;
  define<Vars>({ zones: [bag, line, factory, floor] })
    .withNodes([])
    .rules({
      setup: (tx) => {
        const lines = tx.zones(line, "ann");
        const c: "blue" | "yellow" | "red" | "black" | "white" | undefined =
          tx.entities(lines[0]!)[0]?.props.color;
        void c;
        tx.moveTop(bag, line.of("ann", 2));
        tx.moveTop(bag, factory.at(0));
        // @ts-expect-error -- a per-player counted zone needs a player and an index
        tx.moveTop(bag, line.of("ann"));
        // @ts-expect-error -- a counted zone needs `.at(index)`
        tx.moveTop(bag, factory);
        // @ts-expect-error -- a counted zone has no `.of`
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        void factory.of("ann");
        // @ts-expect-error -- a per-player zone has no `.at`
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        void floor.at(0);
        void tile;
      },
      flow: {
        module: azul.kinds.seq!,
        lower: () => ({ kind: "seq", id: "x", children: [] }),
      },
    });
  const d: Draft = draft.by("ann", {
    from: factory.at(0),
    color: "red",
    to: "floor",
  });
  void d;
  // @ts-expect-error -- not a color
  draft.by("ann", { from: factory.at(0), color: "green", to: 1 });
});

test("fuzz: random play never breaks an invariant", () => {
  const report = fuzz(azul, { seeds: 12, players, maxInputs: 1500 });
  assert.deepEqual(report.failures, []);
});

test("an input's args match the enumerated ones whatever their key order", () => {
  const s = init(azul, { players: ["ann", "bob"], seed: "keys" });
  const legal = legalInputs(azul, s).filter(draft.is)[0]!;
  const { from, color, to } = legal.args;
  // Same args, keys in another order, as a host might send them
  const reordered = { ...legal, args: { to, color, from } };
  assert.deepEqual(
    applyOrThrow(azul, s, reordered),
    applyOrThrow(azul, s, legal),
  );
});
