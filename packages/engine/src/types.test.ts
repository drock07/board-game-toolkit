import { describe, expectTypeOf, test } from "vitest";
import { decision, loop, step } from "./builders.js";
import { defineGame, init } from "./game.js";
import type { GameImpl, TypesFor } from "./impl.js";
import type { DeepReadonly, IsJsonCompatible, Json } from "./json.js";
import type { AnyTypes, Entity, ReadonlyGameState, ZoneIdOf } from "./types.js";

// These tests are checked by `tsc` (typecheck); at runtime they only build
// the example game.

describe("JsonCompatible", () => {
  interface Nested {
    flags: boolean[];
    pair: [number, string];
  }
  interface WithInterfaces {
    n: number;
    s: string;
    maybe?: string;
    nothing: null;
    nested: Nested;
    list: Nested[];
    byKey: Record<string, number>;
  }
  type Alias = { a: number; b?: { c: string[] } };

  test("accepts interfaces, aliases, optional keys and Json itself", () => {
    expectTypeOf<IsJsonCompatible<WithInterfaces>>().toEqualTypeOf<true>();
    expectTypeOf<IsJsonCompatible<Alias>>().toEqualTypeOf<true>();
    expectTypeOf<IsJsonCompatible<Json>>().toEqualTypeOf<true>();
    expectTypeOf<IsJsonCompatible<string[]>>().toEqualTypeOf<true>();
    // An interface in a union with primitives
    expectTypeOf<
      IsJsonCompatible<{ lot: Nested | null }>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      IsJsonCompatible<{ v: Nested | string | 3 }>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      IsJsonCompatible<{ v: Nested | Date }>
    >().toEqualTypeOf<false>();
  });

  test("rejects Date, Map, Set, functions, methods, bigint and required undefined", () => {
    class WithMethod {
      x = 1;
      get() {
        return this.x;
      }
    }
    expectTypeOf<IsJsonCompatible<{ d: Date }>>().toEqualTypeOf<false>();
    expectTypeOf<
      IsJsonCompatible<{ m: Map<string, number> }>
    >().toEqualTypeOf<false>();
    expectTypeOf<IsJsonCompatible<{ s: Set<number> }>>().toEqualTypeOf<false>();
    expectTypeOf<IsJsonCompatible<{ f: () => void }>>().toEqualTypeOf<false>();
    expectTypeOf<IsJsonCompatible<WithMethod>>().toEqualTypeOf<false>();
    expectTypeOf<IsJsonCompatible<{ n: bigint }>>().toEqualTypeOf<false>();
    expectTypeOf<
      IsJsonCompatible<{ u: number | undefined }>
    >().toEqualTypeOf<false>();
    expectTypeOf<IsJsonCompatible<undefined>>().toEqualTypeOf<false>();
  });
});

// A small typed game, used by the tests below
const spec = {
  id: "typed",
  version: 1,
  players: { min: 2, max: 4 },
  zones: {
    deck: { visibility: "hidden" },
    discard: { visibility: "top" },
    hand: { perPlayer: true, visibility: "owner" },
  },
  flow: loop(
    "session",
    decision("turn", { actor: "any" }, { play: {} }, { locals: "fresh" }),
  ),
} as const;

interface Card {
  color: "red" | "blue";
  value: number;
}
interface Vars {
  activeColor: Card["color"] | null;
  scores: Record<string, number>;
}
type Types = TypesFor<
  typeof spec,
  {
    vars: Vars;
    entities: { card: Card; wild: { chosen?: Card["color"] } };
    locals: { turn: { plays: number } };
  }
>;

const impl = {
  setup(tx) {
    tx.vars = { activeColor: null, scores: {} };
    tx.create("card", { color: "red", value: 8 }, "deck");
    tx.create("wild", {}, "deck");
  },
  locals: { fresh: () => ({ plays: 0 }) },
  actions: {
    play: {
      execute(tx) {
        tx.local("turn").plays++;
        tx.moveTop("deck", "discard");
      },
    },
  },
} satisfies GameImpl<Types>;

describe("game types", () => {
  test("zone ids come from the spec", () => {
    expectTypeOf<ZoneIdOf<Types>>().toEqualTypeOf<
      "deck" | "discard" | `hand:${string}`
    >();
  });

  test("defineGame infers the bundle from the impl", () => {
    const game = defineGame({ spec, impl });
    expectTypeOf(game).toEqualTypeOf<typeof game>();
    const { state } = init(game, { players: ["p1", "p2"], seed: "s" });
    expectTypeOf(state.vars).toEqualTypeOf<DeepReadonly<Vars>>();
    expectTypeOf(state.zones.discard.items).toEqualTypeOf<readonly string[]>();
    // Returned states are read-only (checked by tsc; never called)
    const mutate = () => {
      // @ts-expect-error vars can't be assigned
      state.vars.activeColor = "red";
      // @ts-expect-error zone items can't be pushed
      state.zones.discard.items.push("card#0"); // eslint-disable-line @typescript-eslint/no-unsafe-call -- the call is the type error under test
    };
    void mutate;
  });

  test("entities narrow on type", () => {
    const check = (e: ReadonlyGameState<Types>["entities"][string]) => {
      if (e.type === "card")
        expectTypeOf(e.props).toEqualTypeOf<DeepReadonly<Card>>();
      else
        expectTypeOf(e.props).toEqualTypeOf<
          DeepReadonly<{ chosen?: Card["color"] }>
        >();
    };
    void check;
  });

  test("readers and transactions are typed", () => {
    const typed: GameImpl<Types> = {
      setup() {},
      conditions: {
        redOnTop(s) {
          const top = s.top("discard");
          return top?.type === "card" && top.props.color === "red";
        },
        played: (s) => s.local("turn").plays > 0,
      },
      steps: {
        deal(tx, p = "p1") {
          tx.moveTop("deck", `hand:${p}`, 7);
          // @ts-expect-error a typo'd zone name
          tx.move([], "dicard");
          // @ts-expect-error a per-player zone needs its player
          tx.shuffle("hand");
          // @ts-expect-error wrong props for a card
          tx.create("card", { color: "green", value: 1 }, "deck");
          // @ts-expect-error an unknown entity type
          tx.create("token", {}, "deck");
          // @ts-expect-error a wrong vars field
          tx.vars.activeColour = "red";
          // @ts-expect-error locals for an undeclared node
          tx.local("nope");
        },
      },
    };
    void typed;
  });

  test("declaring non-JSON types is an error", () => {
    // @ts-expect-error Date isn't JSON
    type _Bad = TypesFor<typeof spec, { vars: { at: Date } }>;
    type BadEntities = { card: { onPlay: () => void } };
    // @ts-expect-error a function isn't JSON
    type _BadProps = TypesFor<typeof spec, { entities: BadEntities }>;

    // A bundle written by hand is checked by defineGame
    type HandWritten = Omit<AnyTypes, "vars"> & { vars: { at: Date } };
    const badImpl = { setup(_tx) {} } satisfies GameImpl<HandWritten>;
    expectTypeOf(() =>
      defineGame({
        spec: { ...spec, flow: loop("l", step("s", "s"), { until: "c" }) },
        // @ts-expect-error vars aren't JSON
        impl: {
          ...badImpl,
          steps: { s: () => {} },
          conditions: { c: () => true },
        },
      }),
    ).toBeFunction();
  });

  test("the untyped bundle stays permissive", () => {
    expectTypeOf<ZoneIdOf<AnyTypes>>().toEqualTypeOf<string>();
    expectTypeOf<Entity>().toEqualTypeOf<Entity<string, Json, string>>();
  });
});
