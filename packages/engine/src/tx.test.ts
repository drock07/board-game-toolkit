import { describe, expect, test } from "vitest";
import { OpError } from "./errors.js";
import { checkInvariants } from "./invariants.js";
import type { Json } from "./json.js";
import { reduceEvents } from "./reduce.js";
import { createGameState } from "./state.js";
import { openTx, transact } from "./tx.js";
import type { AnyTypes, GameEvent, ReadonlyGameState } from "./types.js";

type Vars = {
  score: number;
  log: string[];
  nested: { hp: Record<string, number> };
};
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };

function fresh(): ReadonlyGameState<Types> {
  return createGameState<Types>({
    game: "test",
    specVersion: 1,
    players: ["p1", "p2"],
    seed: "tx",
    vars: { score: 0, log: [], nested: { hp: { p1: 10, p2: 10 } } },
    zones: [
      { id: "deck", def: "deck" },
      { id: "discard", def: "discard" },
      { id: "hand:p1", def: "hand", owner: "p1" },
      { id: "hand:p2", def: "hand", owner: "p2" },
    ],
  });
}

/** A state with cards a#0..a#4 in the deck, top to bottom. */
function withDeck() {
  return transact(fresh(), (tx) => {
    for (let i = 0; i < 5; i++) tx.create("a", { n: i }, "deck");
  }).state;
}

function expectReplays(
  before: ReadonlyGameState<Types>,
  after: ReadonlyGameState<Types>,
  events: GameEvent<Types>[],
) {
  const replayed = reduceEvents(before, events);
  expect(replayed.entities).toEqual(after.entities);
  expect(replayed.zones).toEqual(after.zones);
  expect(replayed.vars).toEqual(after.vars);
  expect(replayed.status).toEqual(after.status);
  expect(checkInvariants(after)).toEqual([]);
}

describe("create", () => {
  test("assigns counter ids and appends to the bottom by default", () => {
    const before = fresh();
    const { state, events } = transact(before, (tx) => {
      expect(tx.create("card", { v: 1 }, "deck")).toBe("card#0");
      expect(tx.create("card", { v: 2 }, "deck")).toBe("card#1");
      expect(
        tx.create("token", null, "deck", { at: "top", faceUp: true }),
      ).toBe("token#2");
    });
    expect(state.zones.deck!.items).toEqual(["token#2", "card#0", "card#1"]);
    expect(state.entities["token#2"]).toEqual({
      id: "token#2",
      type: "token",
      props: null,
      zone: "deck",
      faceUp: true,
    });
    expect(state.meta.nextEntity).toBe(3);
    expect(events.map((e) => [e.type, e.seq])).toEqual([
      ["created", 0],
      ["created", 1],
      ["created", 2],
    ]);
    expectReplays(before, state, events);
  });

  test("throws on an unknown zone", () => {
    expect(() =>
      transact(fresh(), (tx) => tx.create("a", null, "nope")),
    ).toThrow(OpError);
  });
});

describe("move", () => {
  test("moves a block to the top by default, keeping order", () => {
    const before = withDeck();
    const { state, events } = transact(before, (tx) =>
      tx.move(["a#3", "a#1"], "hand:p1"),
    );
    expect(state.zones["hand:p1"]!.items).toEqual(["a#3", "a#1"]);
    expect(state.zones.deck!.items).toEqual(["a#0", "a#2", "a#4"]);
    expect(events).toEqual([
      {
        seq: 5,
        input: 0,
        type: "moved",
        ids: ["a#3", "a#1"],
        from: ["deck", "deck"],
        to: "hand:p1",
        at: 0,
      },
    ]);
    expectReplays(before, state, events);
  });

  test("positions: bottom and numeric index, within the same zone", () => {
    const before = withDeck();
    const { state, events } = transact(before, (tx) => {
      tx.move("a#0", "deck", { at: "bottom" });
      tx.move("a#4", "deck", { at: 1 });
    });
    expect(state.zones.deck!.items).toEqual([
      "a#1",
      "a#4",
      "a#2",
      "a#3",
      "a#0",
    ]);
    expectReplays(before, state, events);
  });

  test("sets faceUp, and clears it when omitted", () => {
    const before = withDeck();
    const { state, events } = transact(before, (tx) => {
      tx.move("a#0", "discard", { faceUp: true });
      tx.move("a#1", "discard", { faceUp: true });
      tx.move("a#1", "hand:p1");
    });
    expect(state.entities["a#0"]!.faceUp).toBe(true);
    expect("faceUp" in state.entities["a#1"]!).toBe(false);
    expectReplays(before, state, events);
  });

  test("an empty move is a no-op without an event", () => {
    const { events } = transact(withDeck(), (tx) => tx.move([], "discard"));
    expect(events).toEqual([]);
  });

  test("rejects duplicates, unknown ids and out-of-range positions", () => {
    const s = withDeck();
    expect(() =>
      transact(s, (tx) => tx.move(["a#0", "a#0"], "discard")),
    ).toThrow(OpError);
    expect(() => transact(s, (tx) => tx.move("zz#9", "discard"))).toThrow(
      OpError,
    );
    expect(() =>
      transact(s, (tx) => tx.move("a#0", "discard", { at: 2 })),
    ).toThrow(OpError);
  });
});

describe("moveTop", () => {
  test("moves the top n and returns their ids", () => {
    const before = withDeck();
    const { state, events } = transact(before, (tx) => {
      expect(tx.moveTop("deck", "hand:p2", 2)).toEqual(["a#0", "a#1"]);
      expect(tx.moveTop("deck", "discard")).toEqual(["a#2"]);
    });
    expect(state.zones["hand:p2"]!.items).toEqual(["a#0", "a#1"]);
    expectReplays(before, state, events);
  });

  test("throws when the zone holds too few", () => {
    expect(() =>
      transact(withDeck(), (tx) => tx.moveTop("deck", "discard", 6)),
    ).toThrow(/holds 5, needed 6/);
  });
});

describe("shuffle, flip, destroy", () => {
  test("shuffle uses the state's RNG and records the resulting order", () => {
    const before = withDeck();
    const a = transact(before, (tx) => tx.shuffle("deck"));
    const b = transact(before, (tx) => tx.shuffle("deck"));
    expect(a.state.zones.deck!.items).toEqual(b.state.zones.deck!.items);
    expect(a.state.rng).not.toEqual(before.rng);
    expect(a.events[0]).toMatchObject({
      type: "shuffled",
      zone: "deck",
      order: a.state.zones.deck!.items,
    });
    expectReplays(before, a.state, a.events);
  });

  test("flip and destroy", () => {
    const before = withDeck();
    const { state, events } = transact(before, (tx) => {
      tx.flip("a#2", true);
      tx.destroy("a#0");
      expect(tx.create("a", null, "deck")).toBe("a#5"); // ids are never reused
    });
    expect(state.entities["a#2"]!.faceUp).toBe(true);
    expect(state.entities["a#0"]).toBeUndefined();
    expect(events.map((e) => e.type)).toEqual([
      "flipped",
      "destroyed",
      "created",
    ]);
    expectReplays(before, state, events);
  });
});

describe("vars", () => {
  test("draft changes become one vars event at commit, after the op events", () => {
    const before = withDeck();
    const { state, events } = transact(before, (tx) => {
      tx.vars.score += 5;
      tx.move("a#0", "discard");
      tx.vars.log.push("moved");
      tx.vars.nested.hp.p2! -= 3;
    });
    expect(state.vars).toEqual({
      score: 5,
      log: ["moved"],
      nested: { hp: { p1: 10, p2: 7 } },
    });
    expect(events.map((e) => e.type)).toEqual(["moved", "vars"]);
    expect(state.meta.eventCount).toBe(events.at(-1)!.seq + 1);
    expectReplays(before, state, events);
  });

  test("assigning replaces vars wholesale", () => {
    const before = fresh();
    const { state, events } = transact(before, (tx) => {
      tx.vars = { score: 1, log: ["x"], nested: { hp: {} } };
    });
    expect(state.vars).toEqual({ score: 1, log: ["x"], nested: { hp: {} } });
    expectReplays(before, state, events);
  });

  test("tx.state reflects changes so far", () => {
    transact(withDeck(), (tx) => {
      tx.vars.score = 9;
      tx.moveTop("deck", "discard");
      expect(tx.state.vars.score).toBe(9);
      expect(tx.state.zones.discard!.items).toEqual(["a#0"]);
    });
  });

  test("no vars event when vars are untouched", () => {
    const { events } = transact(withDeck(), (tx) => tx.shuffle("deck"));
    expect(events.map((e) => e.type)).toEqual(["shuffled"]);
  });
});

describe("transactions", () => {
  test("never mutate the input state", () => {
    const before = withDeck();
    const copy = structuredClone(before);
    transact(before, (tx) => {
      tx.shuffle("deck");
      tx.moveTop("deck", "discard", 2);
      tx.vars.score = 3;
      tx.random.int(10);
      tx.end({ winner: "p1" });
    });
    expect(before).toEqual(copy);
  });

  test("emit, exit and end", () => {
    const before = fresh();
    const { state, events, exit } = transact(before, (tx) => {
      tx.emit("hello", { a: 1 }, ["p1"]);
      tx.exit("fled");
      tx.exit("ignored");
      tx.end({ winner: "p2" });
      expect(() => tx.end()).toThrow(OpError);
    });
    expect(exit).toBe("fled");
    expect(state.status).toBe("finished");
    expect(state.result).toEqual({ winner: "p2" });
    expect(events.map((e) => e.type)).toEqual(["custom", "ended"]);
    expect(events[0]).toMatchObject({
      name: "hello",
      payload: { a: 1 },
      visibleTo: ["p1"],
    });
    expectReplays(before, state, events);
  });

  test("a committed transaction rejects further use", () => {
    const { tx, commit } = openTx(fresh());
    commit();
    expect(() => tx.vars).toThrow(OpError);
    expect(() => commit()).toThrow(OpError);
  });

  test("values read from tx.state can be stored safely", () => {
    const { state, events } = transact(withDeck(), (tx) => {
      const props = tx.state.entities["a#1"]!.props;
      tx.create("copy", props as Json, "discard");
      tx.emit("seen", tx.state.zones.deck!.items as Json);
    });
    expect(state.entities["copy#5"]!.props).toEqual({ n: 1 });
    expect(events[1]).toMatchObject({
      payload: ["a#0", "a#1", "a#2", "a#3", "a#4"],
    });
  });

  test("events carry the input index", () => {
    const s = withDeck();
    const later: ReadonlyGameState<Types> = {
      ...s,
      meta: { ...s.meta, inputCount: 4 },
    };
    const { events } = transact(later, (tx) => tx.flip("a#0", true));
    expect(events[0]!.input).toBe(4);
  });
});

describe("locals", () => {
  test("tx.local drafts a frame's locals and emits a locals event", () => {
    const s = fresh();
    const withFrame: ReadonlyGameState<Types> = {
      ...s,
      flow: {
        ...s.flow,
        fibers: {
          f0: {
            id: "f0",
            status: "runnable",
            stack: [
              {
                node: "turn",
                phase: "active",
                data: null,
                locals: { rolls: 0, dice: [1, 2] },
              },
            ],
          },
        },
      },
    };
    const { state, events } = transact(
      withFrame,
      (tx) => {
        const l = tx.local<{ rolls: number; dice: number[] }>();
        l.rolls++;
        l.dice[0] = 6;
      },
      {
        locals: () => ({
          node: "turn",
          path: ["flow", "fibers", "f0", "stack", 0, "locals"],
        }),
      },
    );
    expect(state.flow.fibers.f0!.stack[0]!.locals).toEqual({
      rolls: 1,
      dice: [6, 2],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "locals", node: "turn" });
  });

  test("throws without a locals resolver", () => {
    expect(() => transact(fresh(), (tx) => tx.local())).toThrow(OpError);
  });
});
