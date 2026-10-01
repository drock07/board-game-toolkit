import { describe, expect, test } from "vitest";
import { branch, decision, loop, pause, seq, step } from "./builders.js";
import {
  FlowEndedWithoutEndError,
  FlowStuckError,
  GameDefinitionError,
} from "./errors.js";
import {
  apply,
  defineGame,
  init,
  prompts,
  replay,
  type ApplyResult,
} from "./game.js";
import type { GameImpl } from "./impl.js";
import type { GameSpec } from "./spec.js";
import type { AnyTypes, Input, Prompt } from "./types.js";

type Vars = { n: number; log: string[]; hp: number };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };

/** Types an inline impl for these tests' vars, keeping its keys literal. */
const mk = <const I extends GameImpl<Types>>(impl: I): NoInfer<I> => impl;

const base = {
  id: "t",
  version: 1,
  players: { min: 1, max: 3 },
  zones: { deck: { visibility: "hidden" } },
} as const;

function ok<T>(res: T): Extract<T, { ok: true }> {
  const r = res as { ok: boolean; error?: unknown };
  if (!r.ok) throw new Error(`apply failed: ${JSON.stringify(r.error)}`);
  return res as Extract<T, { ok: true }>;
}

function only(res: { prompts: Prompt[] }): Prompt {
  expect(res.prompts).toHaveLength(1);
  return res.prompts[0]!;
}

const cont = (p: Prompt, player = "p1"): Input => ({
  prompt: p.id,
  player,
  continue: true,
});
const act = (p: Prompt, action: string, args?: unknown, player = "p1"): Input =>
  ({
    prompt: p.id,
    player,
    action,
    ...(args === undefined ? {} : { args }),
  }) as Input;

describe("seq, step, pause", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        seq("game", [
          step("a", "addOne"),
          pause("wait", { label: "Go" }),
          step("b", "addOne"),
        ]),
      ),
    },
    impl: mk({
      setup: (tx) => {
        tx.vars = { n: 0, log: [], hp: 0 };
      },
      steps: { addOne: (tx) => void (tx.vars.n += 1) },
    }),
  });

  test("init settles to the first prompt", () => {
    const res = init(game, { players: ["p1"], seed: "s" });
    expect(res.state.vars.n).toBe(1);
    expect(only(res)).toEqual({
      id: "q1",
      node: "wait",
      kind: "pause",
      actors: ["p1"],
      label: "Go",
    });
    expect(prompts(game, res.state)).toEqual(res.prompts);
  });

  test("each input runs to the next prompt; prompt ids keep counting", () => {
    let res = init(game, { players: ["p1"], seed: "s" });
    res = ok(apply(game, res.state, cont(only(res))));
    // b, then the loop restarts the game: a again, then wait
    expect(res.state.vars.n).toBe(3);
    expect(only(res).id).toBe("q2");
    expect(res.state.meta.inputCount).toBe(1);
    expect(res.events.every((e) => e.input === 1)).toBe(true);
  });

  test("apply never mutates its input state", () => {
    const res = init(game, { players: ["p1"], seed: "s" });
    const copy = structuredClone(res.state);
    ok(apply(game, res.state, cont(only(res))));
    expect(res.state).toEqual(copy);
  });

  test("input errors", () => {
    const res = init(game, { players: ["p1", "p2"], seed: "s" });
    const p = only(res);
    expect(apply(game, res.state, { ...cont(p), prompt: "q9" })).toMatchObject({
      ok: false,
      error: { code: "stale_prompt" },
    });
    expect(apply(game, res.state, cont(p, "p3"))).toMatchObject({
      ok: false,
      error: { code: "not_actor" },
    });
    expect(apply(game, res.state, act(p, "x"))).toMatchObject({
      ok: false,
      error: { code: "invalid_args" },
    });
    // A used prompt goes stale (double-click protection)
    const next = ok(apply(game, res.state, cont(p, "p2")));
    expect(apply(game, next.state, cont(p))).toMatchObject({
      ok: false,
      error: { code: "stale_prompt" },
    });
  });

  test("replay rebuilds the same state", () => {
    let res = init(game, { players: ["p1"], seed: "s" });
    const inputs: Input[] = [];
    for (let i = 0; i < 3; i++) {
      const input = cont(only(res));
      inputs.push(input);
      res = ok(apply(game, res.state, input));
    }
    expect(replay(game, { players: ["p1"], seed: "s", inputs })).toEqual(
      res.state,
    );
  });
});

describe("loop", () => {
  test("times, iteration scope, then the next sibling", () => {
    const seen: (number | undefined)[] = [];
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            loop("three", step("rec", "record"), { times: 3 }),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup: () => {},
        steps: {
          record: (tx) => {
            seen.push(tx.scope.iteration);
          },
        },
      }),
    });
    init(game, { players: ["p1"], seed: "s" });
    expect(seen).toEqual([0, 1, 2]);
  });

  test("while is checked before, until after each iteration", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            loop("w", step("incW", "inc"), { while: "below2" }),
            loop("u", step("incU", "inc"), { until: "atLeast5" }),
            loop("never", step("incN", "inc"), { while: "below2" }),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup: (tx) => {
          tx.vars = { n: 0, log: [], hp: 0 };
        },
        steps: { inc: (tx) => void tx.vars.n++ },
        conditions: {
          below2: (s) => s.vars.n < 2,
          atLeast5: (s) => s.vars.n >= 5,
        },
      }),
    });
    expect(init(game, { players: ["p1"], seed: "s" }).state.vars.n).toBe(5);
  });

  test("a loop that never ends without waiting hits the settle budget", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop("spin", step("noop", "noop"), { until: "never" }),
      },
      impl: mk({
        setup: () => {},
        steps: { noop: () => {} },
        conditions: { never: () => false },
      }),
    });
    expect(() => init(game, { players: ["p1"], seed: "s" })).toThrow(
      FlowStuckError,
    );
  });
});

describe("branch", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        seq("game", [
          pause("go"),
          branch(
            "which",
            [{ when: "isOne", then: step("one", "logOne") }],
            step("other", "logOther"),
          ),
          branch("none", [{ when: "never", then: step("unused", "logOne") }]),
        ]),
      ),
    },
    impl: mk({
      setup: (tx) => {
        tx.vars = { n: 1, log: [], hp: 0 };
      },
      conditions: { isOne: (s) => s.vars.n === 1, never: () => false },
      steps: {
        logOne: (tx) => {
          tx.vars.log.push("one");
          tx.vars.n = 2;
        },
        logOther: (tx) => void tx.vars.log.push("other"),
      },
    }),
  });

  test("first matching case, else, and no match", () => {
    let res = init(game, { players: ["p1"], seed: "s" });
    res = ok(apply(game, res.state, cont(only(res))));
    res = ok(apply(game, res.state, cont(only(res))));
    expect(res.state.vars.log).toEqual(["one", "other"]);
  });
});

describe("decision", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        seq("game", [
          decision(
            "turn",
            { actor: "p1", endWhen: "atThree" },
            {
              inc: { ends: false },
              done: {},
              logThen: { then: step("afterLog", "markThen") },
            },
          ),
          pause("after"),
        ]),
      ),
    },
    impl: mk({
      setup: (tx) => {
        tx.vars = { n: 0, log: [], hp: 0 };
      },
      conditions: { atThree: (s) => s.vars.n >= 3 },
      steps: { markThen: (tx) => void tx.vars.log.push("then") },
      actions: {
        inc: {
          validate: (s, args: { by?: number }) =>
            (args.by ?? 1) > 0 ? true : "by must be positive",
          execute: (tx: { vars: Vars }, args: { by?: number }) =>
            void (tx.vars.n += args.by ?? 1),
        },
        done: { execute: () => {} },
        logThen: { execute: (tx) => void tx.vars.log.push("action") },
      },
    }),
  });

  test("the prompt lists actions; ends:false re-prompts until endWhen", () => {
    let res = init(game, { players: ["p1", "p2"], seed: "s" });
    let p = only(res);
    expect(p).toMatchObject({
      kind: "decision",
      node: "turn",
      actors: ["p1"],
      actions: [
        { name: "inc", ends: false },
        { name: "done", ends: true },
        { name: "logThen", ends: true },
      ],
    });
    res = ok(apply(game, res.state, act(p, "inc")));
    p = only(res);
    expect(p.node).toBe("turn");
    expect(p.id).toBe("q2");
    res = ok(apply(game, res.state, act(p, "inc", { by: 2 })));
    expect(only(res).node).toBe("after"); // endWhen: n >= 3
  });

  test("validation and unknown actions return errors", () => {
    const res = init(game, { players: ["p1", "p2"], seed: "s" });
    const p = only(res);
    expect(apply(game, res.state, act(p, "inc", { by: -1 }))).toEqual({
      ok: false,
      error: { code: "validation_failed", message: "by must be positive" },
    });
    expect(apply(game, res.state, act(p, "fly"))).toMatchObject({
      ok: false,
      error: { code: "unknown_action" },
    });
    expect(
      apply(game, res.state, act(p, "done", undefined, "p2")),
    ).toMatchObject({ ok: false, error: { code: "not_actor" } });
  });

  test("then runs after the action, and the decision ends", () => {
    let res = init(game, { players: ["p1"], seed: "s" });
    res = ok(apply(game, res.state, act(only(res), "logThen")));
    expect(res.state.vars.log).toEqual(["action", "then"]);
    expect(only(res).node).toBe("after");
  });
});

describe("guards and outcomes", () => {
  test("a guard true on entry ends the node before it runs; the parent continues", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            seq("play", [pause("never")], { exits: { natural: "isNatural" } }),
            step("after", "markAfter"),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup: (tx) => {
          tx.vars = { n: 21, log: [], hp: 0 };
        },
        conditions: { isNatural: (s) => s.vars.n === 21 },
        steps: { markAfter: (tx) => void tx.vars.log.push("after") },
      }),
    });
    const res = init(game, { players: ["p1"], seed: "s" });
    expect(only(res).node).toBe("end");
    expect(res.state.vars.log).toEqual(["after"]);
    const exits = res.events.filter(
      (e) => e.type === "flow" && e.kind === "exit" && e.node === "play",
    );
    // Handled without an `on` flow: one exit, then the parent continues
    expect(exits).toMatchObject([{ outcome: "natural" }]);
  });

  test("a guard is checked after every transaction, mid-decision", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            step("reset", "reset"),
            decision(
              "fight",
              { actor: "p1" },
              { hit: { ends: false } },
              { exits: { won: "dead" }, on: { won: step("cheer", "cheer") } },
            ),
            pause("over"),
          ]),
        ),
      },
      impl: mk({
        setup: () => {},
        steps: {
          reset: (tx) => {
            tx.vars = { n: 0, log: [], hp: 2 };
          },
          cheer: (tx) => void tx.vars.log.push("cheer"),
        },
        conditions: { dead: (s) => s.vars.hp <= 0 },
        actions: { hit: { execute: (tx) => void tx.vars.hp-- } },
      }),
    });
    let res = init(game, { players: ["p1"], seed: "s" });
    res = ok(apply(game, res.state, act(only(res), "hit")));
    expect(only(res).node).toBe("fight");
    res = ok(apply(game, res.state, act(only(res), "hit")));
    expect(only(res).node).toBe("over");
    expect((res.state.vars as Vars).log).toEqual(["cheer"]);
    // The handled node's `on` flow ran while its guard was still true, without re-firing
  });

  test("guards are checked outermost first", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq(
            "outer",
            [
              seq(
                "inner",
                [pause("wait"), step("kill", "kill"), pause("unreached")],
                {
                  exits: { killed: "dead" },
                  on: { killed: step("markInner", "markInner") },
                },
              ),
            ],
            {
              exits: { victory: "dead" },
              on: {
                victory: seq("won", [
                  step("markOuter", "markOuter"),
                  pause("wonPause"),
                ]),
              },
            },
          ),
        ),
      },
      impl: mk({
        setup: (tx) => {
          tx.vars = { n: 0, log: [], hp: 1 };
        },
        steps: {
          kill: (tx) => void (tx.vars.hp = 0),
          markInner: (tx) => void tx.vars.log.push("inner"),
          markOuter: (tx) => void tx.vars.log.push("outer"),
        },
        conditions: { dead: (s) => s.vars.hp <= 0 },
      }),
    });
    let res = init(game, { players: ["p1"], seed: "s" });
    res = ok(apply(game, res.state, cont(only(res))));
    expect(only(res).node).toBe("wonPause");
    expect(res.state.vars.log).toEqual(["outer"]);
  });
});

describe("locals", () => {
  type L = { rolls: number };
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        decision(
          "turn",
          { actor: "p1", endWhen: "outOfRolls" },
          { roll: { ends: false }, stop: {} },
          { locals: "fresh" },
        ),
      ),
    },
    impl: mk({
      setup: () => {},
      locals: { fresh: () => ({ rolls: 0 }) },
      conditions: { outOfRolls: (s) => s.local<L>().rolls >= 2 },
      actions: {
        roll: {
          validate: (s) => (s.local<L>().rolls < 2 ? true : "No rolls left"),
          execute: (tx) => void tx.local<L>().rolls++,
        },
        stop: { execute: () => {} },
      },
    }),
  });

  test("locals reset each time the frame is pushed, and change through tx.local", () => {
    let res = init(game, { players: ["p1"], seed: "s" });
    const turnLocals = (r: ApplyResult) =>
      r.state.flow.fibers.f0!.stack.at(-1)!.locals;
    expect(turnLocals(res)).toEqual({ rolls: 0 });
    res = ok(apply(game, res.state, act(only(res), "roll")));
    expect(turnLocals(res)).toEqual({ rolls: 1 });
    expect(res.events.filter((e) => e.type === "locals")).toMatchObject([
      { node: "turn", patches: [{ op: "replace", path: ["rolls"], value: 1 }] },
    ]);
    res = ok(apply(game, res.state, act(only(res), "roll")));
    // endWhen ended the turn; the loop pushed a fresh one
    expect(turnLocals(res)).toEqual({ rolls: 0 });
  });
});

describe("ending", () => {
  test("tx.end finishes the game and closes every prompt", () => {
    const game = defineGame({
      spec: { ...base, flow: seq("game", [pause("go"), step("end", "end")]) },
      impl: mk({
        setup: () => {},
        steps: { end: (tx) => tx.end({ winner: "p1" }) },
      }),
    });
    let res = init(game, { players: ["p1"], seed: "s" });
    res = ok(apply(game, res.state, cont(only(res))));
    expect(res.state.status).toBe("finished");
    expect(res.state.result).toEqual({ winner: "p1" });
    expect(res.prompts).toEqual([]);
    expect(apply(game, res.state, cont({ id: "q1" } as Prompt))).toMatchObject({
      ok: false,
      error: { code: "game_finished" },
    });
  });

  test("a flow that runs out without tx.end is a definition bug", () => {
    const game = defineGame({
      spec: { ...base, flow: seq("game", [pause("go")]) },
      impl: mk({ setup: () => {} }),
    });
    const res = init(game, { players: ["p1"], seed: "s" });
    expect(() => apply(game, res.state, cont(only(res)))).toThrow(
      FlowEndedWithoutEndError,
    );
  });
});

describe("defineGame validation", () => {
  test("reports missing and unused impl entries, duplicate ids and unsupported kinds", () => {
    const spec: GameSpec = {
      ...base,
      flow: seq("game", [
        step("a", "missingStep"),
        pause("a"),
        { kind: "parallel", id: "p", children: [], join: "all" },
      ]),
    };
    expect(() =>
      defineGame({
        spec,
        impl: mk({ setup: () => {}, steps: { extra: () => {} } }) as never,
      }),
    ).toThrow(GameDefinitionError);
    try {
      defineGame({
        spec,
        impl: mk({ setup: () => {}, steps: { extra: () => {} } }) as never,
      });
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/Duplicate node id "a"/);
      expect(msg).toMatch(
        /Missing impl\.steps\.missingStep \(used by node "a"\)/,
      );
      expect(msg).toMatch(/Unused impl\.steps\.extra/);
      expect(msg).toMatch(/unsupported kind "parallel"/);
    }
  });

  test("rejects a loop that can never end or wait", () => {
    expect(() =>
      defineGame({
        spec: { ...base, flow: loop("spin", step("s", "s")) },
        impl: mk({ setup: () => {}, steps: { s: () => {} } }),
      }),
    ).toThrow(/can never end or wait/);
  });

  test("refs are checked at the type level", () => {
    const spec = {
      ...base,
      flow: loop("l", decision("d", { actor: "any" }, { go: {} }), {
        until: "done",
      }),
    } as const;
    const execute = () => {};
    defineGame({
      spec,
      impl: mk({
        setup: () => {},
        actions: { go: { execute } },
        conditions: { done: () => true },
      }),
    });
    expect(() =>
      defineGame({
        spec,
        // @ts-expect-error missing impl.conditions.done
        impl: mk({ setup: () => {}, actions: { go: { execute } } }),
      }),
    ).toThrow();
    expect(() =>
      defineGame({
        spec,
        // @ts-expect-error unused impl.steps.extra
        impl: mk({
          setup: () => {},
          actions: { go: { execute } },
          conditions: { done: () => true },
          steps: { extra: () => {} },
        }),
      }),
    ).toThrow();
  });
});
