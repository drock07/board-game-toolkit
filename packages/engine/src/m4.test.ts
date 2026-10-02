import { describe, expect, test } from "vitest";
import { decision, exit, loop, pause, seq, step, subflow } from "./builders.js";
import { UnhandledOutcomeError } from "./errors.js";
import { apply, defineGame, init } from "./game.js";
import type { GameImpl } from "./impl.js";
import type { GameSpec } from "./spec.js";
import type { Tx } from "./tx.js";
import type { AnyTypes, Input, Prompt } from "./types.js";

type Vars = { log: string[]; hp: number };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };
const mk = <const I extends GameImpl<Types>>(impl: I): NoInfer<I> => impl;

const base = {
  id: "m4",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
} as const;
const setup = (tx: Tx<Types>) => {
  tx.vars = { log: [], hp: 3 };
};
const log = (entry: string) => (tx: Tx<Types>) => void tx.vars.log.push(entry);

function ok<R>(res: R): Extract<R, { ok: true }> {
  const r = res as { ok: boolean; error?: unknown };
  if (!r.ok) throw new Error(`apply failed: ${JSON.stringify(r.error)}`);
  return res as Extract<R, { ok: true }>;
}
const p = (r: { prompts: Prompt[] }) => r.prompts[0]!;
const act = (r: { prompts: Prompt[] }, action: string): Input => ({
  prompt: p(r).id,
  player: "p1",
  action,
});

describe("exit", () => {
  test("unwinds to the nearest handler, runs its on flow, and the parent continues", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            seq(
              "outer",
              [
                seq("inner", [
                  step("before", "before"),
                  exit("leave", "fled"),
                  step("skipped", "skipped"),
                ]),
                step("alsoSkipped", "skipped"),
              ],
              { on: { fled: step("onFled", "onFled") } },
            ),
            step("after", "after"),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup,
        steps: {
          before: log("before"),
          skipped: log("skipped"),
          onFled: log("onFled"),
          after: log("after"),
        },
      }),
    });
    const r = init(game, { players: ["p1"], seed: "s" });
    expect(r.state.vars.log).toEqual(["before", "onFled", "after"]);
    expect(p(r).node).toBe("end");
  });

  test("an outcome handled in exits without an on flow just ends that node", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            seq(
              "guarded",
              [exit("leave", "stop"), step("skipped", "skipped")],
              { exits: { stop: "never" } },
            ),
            step("after", "after"),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup,
        conditions: { never: () => false },
        steps: { skipped: log("skipped"), after: log("after") },
      }),
    });
    expect(init(game, { players: ["p1"], seed: "s" }).state.vars.log).toEqual([
      "after",
    ]);
  });

  test("an outcome raised in an on flow passes over the node handling it", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq(
            "outer",
            [
              seq("inner", [exit("first", "x")], {
                on: {
                  x: seq("handler", [
                    step("inHandler", "inHandler"),
                    exit("again", "x"),
                  ]),
                },
              }),
              step("skipped", "skipped"),
            ],
            {
              on: {
                x: seq("outerHandler", [
                  step("outerX", "outerX"),
                  pause("end"),
                ]),
              },
            },
          ),
        ),
      },
      impl: mk({
        setup,
        steps: {
          inHandler: log("inner"),
          skipped: log("skipped"),
          outerX: log("outer"),
        },
      }),
    });
    const r = init(game, { players: ["p1"], seed: "s" });
    expect(r.state.vars.log).toEqual(["inner", "outer"]);
    expect(p(r).node).toBe("end");
  });
});

describe("tx.exit", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        seq("game", [
          loop(
            "fight",
            decision(
              "turn",
              { actor: "p1" },
              { flee: { ends: false }, wait: { ends: false } },
            ),
            {
              on: { fled: step("logFlee", "logFlee") },
            },
          ),
          pause("end"),
        ]),
      ),
    },
    impl: mk({
      setup,
      steps: { logFlee: log("fled") },
      actions: {
        flee: {
          execute(tx) {
            tx.exit("fled");
            // The rest of the handler still runs
            tx.vars.log.push("after exit");
          },
        },
        wait: { execute: log("wait") },
      },
    }),
  });

  test("takes effect at commit: the handler finishes, then the outcome unwinds", () => {
    let r = init(game, { players: ["p1"], seed: "s" });
    r = ok(apply(game, r.state, act(r, "wait")));
    expect(p(r).node).toBe("turn");
    r = ok(apply(game, r.state, act(r, "flee")));
    expect(r.state.vars.log).toEqual(["wait", "after exit", "fled"]);
    expect(p(r).node).toBe("end");
  });

  test("an outcome nothing handles throws", () => {
    const bad = defineGame({
      spec: {
        ...base,
        flow: loop("session", decision("turn", { actor: "p1" }, { go: {} })),
      },
      impl: mk({
        setup,
        actions: { go: { execute: (tx) => tx.exit("nowhere") } },
      }),
    });
    const r = init(bad, { players: ["p1"], seed: "s" });
    expect(() => apply(bad, r.state, act(r, "go"))).toThrow(
      UnhandledOutcomeError,
    );
  });
});

describe("use and subflows", () => {
  const spec = {
    ...base,
    flow: loop(
      "session",
      seq("game", [
        subflow("first", "fight"),
        subflow("second", "fight"),
        pause("end"),
      ]),
    ),
    subflows: {
      fight: seq(
        "fight",
        [
          decision("attack", { actor: "p1" }, { hit: {} }),
          subflow("cleanup", "cleanup"),
        ],
        { locals: "fightLocals" },
      ),
      cleanup: step("tidy", "tidy"),
    },
  } as const;
  const game = defineGame({
    spec,
    impl: mk({
      setup,
      locals: { fightLocals: () => ({ hits: 0 }) },
      steps: { tidy: log("tidy") },
      actions: {
        hit: {
          execute(tx) {
            // The nearest locals are the enclosing fight's
            tx.local<{ hits: number }>().hits++;
            tx.vars.log.push(
              `hit ${tx.state.flow.fibers.f0!.stack.at(-2)!.node}`,
            );
          },
        },
      },
    }),
  });

  test("each use runs the subflow with ids prefixed by the use node's id", () => {
    let r = init(game, { players: ["p1"], seed: "s" });
    expect(p(r).node).toBe("first.attack");
    r = ok(apply(game, r.state, act(r, "hit")));
    expect(p(r).node).toBe("second.attack");
    r = ok(apply(game, r.state, act(r, "hit")));
    expect(r.state.vars.log).toEqual([
      "hit first.fight",
      "tidy",
      "hit second.fight",
      "tidy",
    ]);
    expect([...game.nodes.keys()]).toEqual(
      expect.arrayContaining(["first.cleanup.tidy", "second.cleanup.tidy"]),
    );
    expect(p(r).node).toBe("end");
  });

  test("bad subflows and unhandled exits are definition errors", () => {
    const bad = (s: Partial<GameSpec>) => () =>
      defineGame({
        spec: { ...base, flow: pause("p"), ...s },
        impl: { setup() {} } as never,
      });
    expect(bad({ flow: subflow("u", "missing") })).toThrow(
      /unknown subflow "missing"/,
    );
    expect(bad({ subflows: { spare: pause("x") } })).toThrow(
      /Unused subflow "spare"/,
    );
    expect(
      bad({ flow: subflow("u", "a"), subflows: { a: subflow("b", "a") } }),
    ).toThrow(/Subflow "a" uses itself/);
    expect(bad({ flow: seq("s", [exit("e", "boom")]) })).toThrow(
      /raises "boom", which no enclosing node handles/,
    );
    expect(bad({ flow: seq("s", [exit("e", "done")]) })).toThrow(
      /can't raise "done"/,
    );
    // A node doesn't handle outcomes raised from its own on flow
    expect(
      bad({ flow: seq("s", [pause("p")], { on: { x: exit("e", "x") } }) }),
    ).toThrow(/no enclosing node handles/);
    expect(
      bad({
        flow: seq("s", [seq("t", [exit("e", "x")])], { on: { x: pause("h") } }),
      }),
    ).not.toThrow();
  });
});

test("values can move between locals and vars in one transaction", () => {
  type Bag = { item: { name: string }; taken: boolean };
  type BagTypes = Omit<AnyTypes, "vars"> & {
    vars: { items: { name: string }[] };
  };
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        decision(
          "turn",
          { actor: "p1" },
          { take: { ends: false } },
          { locals: "bag" },
        ),
      ),
    },
    impl: {
      setup(tx: Tx<BagTypes>) {
        tx.vars = { items: [] };
      },
      locals: { bag: () => ({ item: { name: "sword" }, taken: false }) },
      actions: {
        take: {
          execute(tx: Tx<BagTypes>) {
            const bag = tx.local<Bag>();
            // A drafted locals value moves into the vars draft
            tx.vars.items.push(bag.item);
            bag.taken = true;
          },
        },
      },
    } satisfies GameImpl<BagTypes>,
  });
  let r = init(game, { players: ["p1"], seed: "s" });
  r = ok(apply(game, r.state, act(r, "take")));
  // Reading after commit would throw on a revoked proxy
  expect(JSON.parse(JSON.stringify(r.state.vars))).toEqual({
    items: [{ name: "sword" }],
  });
  expect(r.state.flow.fibers.f0!.stack.at(-1)!.locals).toEqual({
    item: { name: "sword" },
    taken: true,
  });
  expect(r.events.map((e) => e.type)).toEqual(
    expect.arrayContaining(["vars", "locals"]),
  );
  r = ok(apply(game, r.state, act(r, "take")));
  expect(r.state.vars.items).toHaveLength(2);
});
