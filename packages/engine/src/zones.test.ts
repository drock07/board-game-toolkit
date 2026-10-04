import { describe, expect, test } from "vitest";
import { decision, each, loop, pause, seq, step } from "./builders.js";
import { GameDefinitionError } from "./errors.js";
import { apply, defineGame, init, type Game } from "./game.js";
import type { GameImpl, SetupContext } from "./impl.js";
import type { GameSpec } from "./spec.js";
import { transact } from "./tx.js";
import type { AnyTypes, Input } from "./types.js";
import { isHidden, view } from "./view.js";

type Vars = { full: string[] };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };

// Azul's shape: a shared bag, a factory per 2n + 1, five pattern lines and a
// floor per player
const spec = {
  id: "zones",
  version: 1,
  players: { min: 2, max: 4 },
  zones: {
    bag: { visibility: "hidden" },
    factory: { count: { ref: "factories" }, visibility: "public" },
    patternLine: { perPlayer: true, count: 5, visibility: "owner" },
    floor: { perPlayer: true, visibility: "public" },
  },
  vars: { full: {} },
  flow: loop("session", decision("turn", { actor: "p1" }, { take: {} })),
  triggers: [
    {
      id: "lineFull",
      // Matches every instance of the family by its def name
      on: { type: "moved", to: "patternLine" },
      when: "filled",
      flow: step("noteFull", "noteFull"),
    },
  ],
} as const satisfies GameSpec;

// A line at index i holds i + 1 tiles
const capacity = (index: number) => index + 1;

const impl = {
  setup(tx) {
    tx.vars = { full: [] };
    for (let i = 0; i < 20; i++) tx.create("tile", { n: i }, "bag");
    for (const f of tx.zonesOf("factory")) tx.moveTop("bag", f.id, 2);
  },
  zoneCounts: { factories: ({ players }) => 2 * players.length + 1 },
  conditions: {
    filled: (s, scope) => {
      if (scope.event?.type !== "moved") return false;
      const line = s.zone(scope.event.to);
      return line.items.length >= capacity(line.index!);
    },
  },
  steps: {
    noteFull(tx) {
      const event = tx.scope.event!;
      if (event.type === "moved") tx.vars.full.push(event.to);
    },
  },
  actions: {
    take: {
      execute(tx, args: { factory: number; line: number }) {
        const from = tx.zonesOf("factory")[args.factory]!;
        const line = tx.zonesOf("patternLine", tx.scope.actor)[args.line]!;
        tx.move(from.items, line.id);
      },
    },
  },
} satisfies GameImpl<Types>;

const game = defineGame({ spec, impl }) as unknown as Game<Types>;
const start = (players = ["p1", "p2", "p3"]) =>
  init(game, { players, seed: "s" });

describe("zone families", () => {
  test("count and perPlayer multiply into instances with ids, owners and indexes", () => {
    const { state } = start();
    expect(Object.keys(state.zones)).toEqual([
      "bag",
      ...Array.from({ length: 7 }, (_, i) => `factory:${i}`),
      ...["p1", "p2", "p3"].flatMap((p) =>
        Array.from({ length: 5 }, (_, i) => `patternLine:${p}:${i}`),
      ),
      "floor:p1",
      "floor:p2",
      "floor:p3",
    ]);
    expect(state.zones["factory:6"]).toMatchObject({
      def: "factory",
      index: 6,
    });
    expect(state.zones["factory:6"]!.owner).toBeUndefined();
    expect(state.zones["patternLine:p2:3"]).toMatchObject({
      def: "patternLine",
      owner: "p2",
      index: 3,
    });
    expect(state.zones["floor:p1"]!.index).toBeUndefined();
    expect(Object.keys(state.zones.bag!).sort()).toEqual([
      "def",
      "id",
      "items",
    ]);
  });

  test("a count ref sees the seating and the options", () => {
    const counted = defineGame({
      spec,
      impl: {
        ...impl,
        zoneCounts: {
          factories: ({ players, options }: SetupContext) =>
            players.length + (options as { extra: number }).extra,
        },
      },
    });
    const { state } = init(counted, {
      players: ["p1", "p2"],
      seed: "s",
      options: { extra: 3 },
    });
    expect(
      Object.keys(state.zones).filter((z) => z.startsWith("factory:")),
    ).toHaveLength(5);
  });

  test("zonesOf lists a family in seat then index order", () => {
    const { state } = transact(start().state, (tx) => {
      expect(tx.zonesOf("factory").map((z) => z.index)).toEqual([
        0, 1, 2, 3, 4, 5, 6,
      ]);
      expect(tx.zonesOf("patternLine", "p2").map((z) => z.id)).toEqual([
        "patternLine:p2:0",
        "patternLine:p2:1",
        "patternLine:p2:2",
        "patternLine:p2:3",
        "patternLine:p2:4",
      ]);
      expect(tx.zonesOf("patternLine").map((z) => z.owner)).toEqual(
        ["p1", "p2", "p3"].flatMap((p) => Array<string>(5).fill(p)),
      );
      expect(tx.zonesOf("floor").map((z) => z.id)).toEqual([
        "floor:p1",
        "floor:p2",
        "floor:p3",
      ]);
      expect(tx.zonesOf("bag").map((z) => z.id)).toEqual(["bag"]);
      // Reflects moves made earlier in the transaction
      tx.moveTop("factory:0", "floor:p1");
      expect(tx.zonesOf("floor", "p1")[0]!.items).toHaveLength(1);
    });
    expect(state.zones["floor:p1"]!.items).toHaveLength(1);
  });

  test("moved triggers match any instance of the family", () => {
    const r = start();
    const take = (line: number): Input => ({
      prompt: r.prompts[0]!.id,
      player: "p1",
      action: "take",
      args: { factory: 0, line },
    });
    // Two tiles fill the line at index 1, not the one at index 4
    const filled = apply(game, r.state, take(1));
    expect(filled.ok && filled.state.vars.full).toEqual(["patternLine:p1:1"]);
    const partial = apply(game, r.state, take(4));
    expect(partial.ok && partial.state.vars.full).toEqual([]);
  });

  test("owner visibility applies to per-player counted zones", () => {
    const { state } = transact(start().state, (tx) =>
      tx.moveTop("factory:0", "patternLine:p1:2"),
    );
    const own = view(game, state, "p1").zones["patternLine:p1:2"]!;
    const other = view(game, state, "p2");
    expect(own.items).toEqual([expect.stringMatching(/^tile#/)]);
    const [hidden] = other.zones["patternLine:p1:2"]!.items;
    expect(isHidden(other.entities[hidden!]!)).toBe(true);
  });

  test("count expressions take $item from an each over a ref", () => {
    const counting = defineGame({
      spec: {
        id: "items",
        version: 1,
        players: { min: 1, max: 1 },
        zones: { slot: { count: 3, visibility: "public" } },
        vars: { full: {} },
        flow: seq("game", [
          each(
            "slots",
            { ref: "indexes" },
            step("check", "check", {
              exits: { occupied: { gte: [{ count: "slot:$item" }, 1] } },
            }),
          ),
          pause("end"),
        ]),
      },
      impl: {
        setup(tx) {
          tx.vars = { full: [] };
          tx.create("piece", {}, "slot:1");
        },
        lists: { indexes: () => [0, 1, 2] },
        steps: {
          check: (tx) => void tx.vars.full.push(JSON.stringify(tx.scope.item)),
        },
      } satisfies GameImpl<Types>,
    });
    const r = init(counting, { players: ["p1"], seed: "s" });
    // Slot 1 is occupied, so its step exits before running
    expect(r.state.vars.full).toEqual(["0", "2"]);
  });

  test("$item must be a string or number", () => {
    const bad = defineGame({
      spec: {
        id: "bad-item",
        version: 1,
        players: { min: 1, max: 1 },
        zones: { slot: { count: 1, visibility: "public" } },
        flow: seq("game", [
          each(
            "slots",
            { ref: "objects" },
            step("check", "check", {
              exits: { occupied: { gte: [{ count: "slot:$item" }, 1] } },
            }),
          ),
          pause("end"),
        ]),
      },
      impl: {
        setup() {},
        lists: { objects: () => [{ i: 0 }] },
        steps: { check: () => {} },
      } satisfies GameImpl<Types>,
    });
    expect(() => init(bad, { players: ["p1"], seed: "s" })).toThrow(
      /\$item needs/,
    );
  });

  describe("definition errors", () => {
    const withZones =
      (zones: GameSpec["zones"], extra: object = {}) =>
      () => {
        // Widened, so refs are checked at runtime only
        const widened: GameSpec = { ...spec, zones, triggers: [] };
        return defineGame({
          spec: widened,
          impl: { ...impl, conditions: {}, steps: {}, ...extra },
        });
      };

    test("a missing or unused count ref", () => {
      expect(
        withZones(
          { factory: { count: { ref: "nope" }, visibility: "public" } },
          { zoneCounts: {} },
        ),
      ).toThrow(/Missing impl\.zoneCounts\.nope \(used by zone "factory"\)/);
      expect(withZones({ factory: { visibility: "public" } })).toThrow(
        /Unused impl\.zoneCounts\.factories/,
      );
    });

    test("a count that isn't a whole number >= 0", () => {
      expect(
        withZones(
          { a: { count: -1, visibility: "public" } },
          { zoneCounts: undefined },
        ),
      ).toThrow(/Zone "a": count must be a whole number >= 0/);
      const badRef = defineGame({
        spec,
        impl: { ...impl, zoneCounts: { factories: () => 1.5 } },
      });
      expect(() => init(badRef, { players: ["p1", "p2"], seed: "s" })).toThrow(
        GameDefinitionError,
      );
    });
  });
});
