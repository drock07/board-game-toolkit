import { describe, expect, test } from "vitest";
import { checkInvariants } from "./invariants.js";
import { jsonEqual, type Json } from "./json.js";
import { reduceEvents } from "./reduce.js";
import { seededRandom, type Random } from "./rng.js";
import { createGameState } from "./state.js";
import { transact, type Tx } from "./tx.js";
import type { GameState, Position } from "./types.js";

type Vars = {
  counters: Record<string, number>;
  list: Json[];
  flag: boolean | null;
};

const ZONES = ["deck", "discard", "hand:p1", "hand:p2", "board"];

function randomPosition(r: Random, length: number): Position {
  const k = r.int(3);
  return k === 0 ? "top" : k === 1 ? "bottom" : r.int(length + 1);
}

/** One random op, chosen among those that are valid in the current state. */
function randomOp(tx: Tx<Vars>, r: Random) {
  const s = tx.state;
  const ids = Object.keys(s.entities);
  const zone = r.pick(ZONES);
  switch (r.int(10)) {
    case 0:
    case 1: {
      const opts = r.int(2)
        ? { at: randomPosition(r, s.zones[zone]!.items.length) }
        : {};
      tx.create(r.pick(["card", "token"]), { n: r.int(100) }, zone, opts);
      return;
    }
    case 2:
    case 3: {
      if (!ids.length) return;
      const picked = r
        .shuffle(ids)
        .slice(0, 1 + r.int(Math.min(3, ids.length)));
      const remaining = s.zones[zone]!.items.filter(
        (id) => !picked.includes(id),
      ).length;
      const faceUp = [undefined, true, false][r.int(3)];
      tx.move(picked, zone, {
        at: randomPosition(r, remaining),
        ...(faceUp === undefined ? {} : { faceUp }),
      });
      return;
    }
    case 4: {
      const from = r.pick(ZONES);
      const n = s.zones[from]!.items.length;
      if (n) tx.moveTop(from, zone, 1 + r.int(n));
      return;
    }
    case 5:
      tx.shuffle(zone);
      return;
    case 6:
      if (ids.length) tx.flip(r.pick(ids), r.int(2) === 0);
      return;
    case 7:
      if (ids.length) tx.destroy(r.pick(ids));
      return;
    case 8: {
      const k = r.int(4);
      if (k === 0) tx.vars.counters[`c${r.int(4)}`] = r.int(50);
      else if (k === 1) tx.vars.list.push({ v: r.int(9) });
      else if (k === 2 && tx.vars.list.length)
        tx.vars.list.splice(r.int(tx.vars.list.length), 1);
      else tx.vars.flag = r.pick([true, false, null]);
      return;
    }
    case 9:
      if (r.int(20) === 0 && s.status === "running") tx.end({ at: r.int(10) });
      else tx.emit("note", r.int(5));
      return;
  }
}

describe("replay property", () => {
  test("reduceEvents(before, events) equals after on random op sequences", () => {
    for (let seed = 0; seed < 300; seed++) {
      const r = seededRandom(`ops-${seed}`);
      let state: GameState<Vars> = createGameState<Vars>({
        game: "prop",
        specVersion: 1,
        players: ["p1", "p2"],
        seed: `game-${seed}`,
        vars: { counters: {}, list: [], flag: null },
        zones: ZONES.map((id) => ({ id, def: id.split(":")[0]! })),
      });
      for (let t = 0; t < 15; t++) {
        const before = state;
        const { state: after, events } = transact(before, (tx) => {
          const n = 1 + r.int(8);
          for (let i = 0; i < n; i++) randomOp(tx, r);
        });
        const replayed = reduceEvents(before, events);
        const ctx = `seed ${seed}, tx ${t}`;
        expect(jsonEqual(replayed.entities, after.entities), ctx).toBe(true);
        expect(jsonEqual(replayed.zones, after.zones), ctx).toBe(true);
        expect(jsonEqual(replayed.vars, after.vars), ctx).toBe(true);
        expect(replayed.status, ctx).toBe(after.status);
        expect(checkInvariants(after), ctx).toEqual([]);
        // Event seqs are contiguous and match the counter
        expect(
          events.map((e) => e.seq),
          ctx,
        ).toEqual(events.map((_, i) => before.meta.eventCount + i));
        expect(after.meta.eventCount, ctx).toBe(
          before.meta.eventCount + events.length,
        );
        state = after;
      }
    }
  });

  test("a whole game's events replay from the initial state in one pass", () => {
    const r = seededRandom("long");
    const initial = createGameState<Vars>({
      game: "prop",
      specVersion: 1,
      players: ["p1"],
      seed: "long",
      vars: { counters: {}, list: [], flag: null },
      zones: ZONES.map((id) => ({ id, def: id })),
    });
    let state = initial;
    const all = [];
    for (let t = 0; t < 50; t++) {
      const res = transact(state, (tx) => {
        for (let i = 0; i < 5; i++) randomOp(tx, r);
      });
      all.push(...res.events);
      state = res.state;
    }
    const replayed = reduceEvents(initial, all);
    expect(jsonEqual(replayed.entities, state.entities)).toBe(true);
    expect(jsonEqual(replayed.zones, state.zones)).toBe(true);
    expect(jsonEqual(replayed.vars, state.vars)).toBe(true);
  });
});

describe("checkInvariants", () => {
  test("reports a desynced back-reference and a duplicated entity", () => {
    const s = transact(
      createGameState({
        game: "g",
        specVersion: 1,
        players: [],
        seed: "",
        vars: null,
        zones: [
          { id: "a", def: "a" },
          { id: "b", def: "b" },
        ],
      }),
      (tx) => {
        tx.create("x", null, "a");
      },
    ).state;
    const broken = structuredClone(s) as GameState;
    broken.zones.b!.items.push("x#0");
    expect(checkInvariants(broken)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/both "a" and "b"/),
        expect.stringMatching(/says zone "a" but is in "b"/),
      ]),
    );
  });
});
