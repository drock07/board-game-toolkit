import { describe, expect, test } from "vitest";
import {
  decision,
  each,
  exit,
  loop,
  parallel,
  pause,
  seq,
  step,
} from "./builders.js";
import { apply, defineGame, init, legalInputs, type Game } from "./game.js";
import type { GameImpl } from "./impl.js";
import type { TriggerDef } from "./spec.js";
import type { Tx } from "./tx.js";
import type { AnyTypes, Input, Prompt } from "./types.js";

type Vars = { log: string[]; stop: boolean };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };
const mk = <const I extends GameImpl<Types>>(impl: I): NoInfer<I> => impl;

const base = {
  id: "m5",
  version: 1,
  players: { min: 1, max: 3 },
  zones: { deck: { visibility: "public" }, pile: { visibility: "public" } },
} as const;
const setup = (tx: Tx<Types>) => {
  tx.vars = { log: [], stop: false };
};
const log = (entry: string) => (tx: Tx<Types>) => void tx.vars.log.push(entry);
const logActor = (tx: Tx<Types>) => void tx.vars.log.push(tx.scope.actor!);

function ok<R>(res: R): Extract<R, { ok: true }> {
  const r = res as { ok: boolean; error?: unknown };
  if (!r.ok) throw new Error(`apply failed: ${JSON.stringify(r.error)}`);
  return res as Extract<R, { ok: true }>;
}
const byNode = (r: { prompts: Prompt[] }, node: string) =>
  r.prompts.find((p) => p.node === node)!;
const act = (p: Prompt, player: string, action = "go"): Input => ({
  prompt: p.id,
  player,
  action,
});

describe("parallel", () => {
  const game = (join: "all" | "race") =>
    defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            parallel(
              "both",
              [
                decision("left", { actor: "p1" }, { go: {} }),
                decision("right", { actor: "p2" }, { go: {} }),
              ],
              { join },
            ),
            step("after", "after"),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup,
        steps: { after: log("after") },
        actions: { go: { execute: logActor } },
      }),
    });

  test("all: both prompts open at once, answered in any order, then it joins", () => {
    const g = game("all");
    let r = init(g, { players: ["p1", "p2"], seed: "s" });
    expect(r.prompts.map((p) => p.node)).toEqual(["left", "right"]);
    r = ok(apply(g, r.state, act(byNode(r, "right"), "p2")));
    expect(r.prompts.map((p) => p.node)).toEqual(["left"]);
    r = ok(apply(g, r.state, act(byNode(r, "left"), "p1")));
    expect(r.state.vars.log).toEqual(["p2", "p1", "after"]);
    expect(r.prompts.map((p) => p.node)).toEqual(["end"]);
    // Finished fibers are removed
    expect(Object.keys(r.state.flow.fibers)).toEqual(["f0"]);
  });

  test("race: the first branch to finish cancels the rest", () => {
    const g = game("race");
    let r = init(g, { players: ["p1", "p2"], seed: "s" });
    const left = byNode(r, "left");
    r = ok(apply(g, r.state, act(byNode(r, "right"), "p2")));
    expect(r.state.vars.log).toEqual(["p2", "after"]);
    expect(r.prompts.map((p) => p.node)).toEqual(["end"]);
    expect(apply(g, r.state, act(left, "p1"))).toMatchObject({
      ok: false,
      error: { code: "stale_prompt" },
    });
  });

  test("an outcome a branch doesn't handle cancels its siblings and passes up", () => {
    const g = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq(
            "game",
            [
              parallel(
                "both",
                [
                  decision("left", { actor: "p1" }, { go: {} }),
                  seq("right", [exit("bail", "abort")]),
                ],
                { join: "all" },
              ),
              step("skipped", "skipped"),
            ],
            {
              on: {
                abort: seq("aborted", [step("note", "note"), pause("end")]),
              },
            },
          ),
        ),
      },
      impl: mk({
        setup,
        steps: { skipped: log("skipped"), note: log("aborted") },
        actions: { go: { execute: logActor } },
      }),
    });
    const r = init(g, { players: ["p1", "p2"], seed: "s" });
    expect(r.state.vars.log).toEqual(["aborted"]);
    expect(r.prompts.map((p) => p.node)).toEqual(["end"]);
    expect(Object.keys(r.state.flow.fibers)).toEqual(["f0"]);
  });

  test("a guard above the parallel cancels its open branches", () => {
    const g = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq(
            "game",
            [
              parallel(
                "both",
                [
                  decision("left", { actor: "p1" }, { stop: {} }),
                  decision("right", { actor: "p2" }, { go: {} }),
                ],
                { join: "all" },
              ),
            ],
            { exits: { stopped: "stopped" }, on: { stopped: pause("end") } },
          ),
        ),
      },
      impl: mk({
        setup,
        conditions: { stopped: (s) => s.vars.stop },
        actions: {
          go: { execute: logActor },
          stop: { execute: (tx) => void (tx.vars.stop = true) },
        },
      }),
    });
    let r = init(g, { players: ["p1", "p2"], seed: "s" });
    r = ok(apply(g, r.state, act(byNode(r, "left"), "p1", "stop")));
    expect(r.prompts.map((p) => p.node)).toEqual(["end"]);
    expect(Object.keys(r.state.flow.fibers)).toEqual(["f0"]);
  });
});

describe("parallel each", () => {
  test("every player answers their own prompt; their fibers see the parent's scope and locals", () => {
    const g = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq(
            "round",
            [
              each(
                "bids",
                { players: "clockwise" },
                decision("bid", { actor: "current" }, { go: {} }),
                { mode: "parallel" },
              ),
              step("reveal", "reveal"),
              pause("end"),
            ],
            { locals: "roundLocals" },
          ),
        ),
      },
      impl: mk({
        setup,
        locals: { roundLocals: () => ({ bids: 0 }) },
        steps: {
          reveal: (tx) =>
            void tx.vars.log.push(`bids: ${tx.local<{ bids: number }>().bids}`),
        },
        actions: {
          go: {
            execute(tx) {
              // The round's locals live on the parent fiber
              tx.local<{ bids: number }>().bids++;
              tx.vars.log.push(`${tx.scope.actor}=${tx.scope.player}`);
            },
          },
        },
      }),
    });
    let r = init(g, { players: ["p1", "p2", "p3"], seed: "s" });
    expect(r.prompts.map((p) => p.actors)).toEqual([["p1"], ["p2"], ["p3"]]);
    expect(legalInputs(g, r.state, "p2")).toHaveLength(1);
    for (const p of ["p3", "p1", "p2"]) {
      const prompt = r.prompts.find((x) => x.actors[0] === p)!;
      r = ok(apply(g, r.state, act(prompt, p)));
    }
    expect(r.state.vars.log).toEqual(["p3=p3", "p1=p1", "p2=p2", "bids: 3"]);
    expect(r.prompts.map((p) => p.node)).toEqual(["end"]);
  });
});

describe("triggers", () => {
  type Extra = Pick<GameImpl<Types>, "steps" | "conditions" | "actions">;
  const steps = {
    a: log("a"),
    b: log("b"),
    c: log("c"),
    moveToken: (tx: Tx<Types>) => void tx.move("token#1", "pile"),
    logEvent: (tx: Tx<Types>) =>
      void tx.vars.log.push(`event ${tx.scope.event?.type}`),
  };
  const game = (
    triggers: TriggerDef[],
    extra: Extra = {},
    triggerOrder?: "fifo" | "lifo",
  ) =>
    defineGame({
      spec: {
        ...base,
        triggerOrder,
        flow: loop(
          "session",
          seq("game", [
            decision("turn", { actor: "p1" }, { play: {}, note: {} }),
            step("after", "after"),
            pause("end"),
          ]),
        ),
        triggers,
      },
      impl: {
        setup(tx: Tx<Types>) {
          setup(tx);
          tx.create("card", { value: 2 }, "deck");
          tx.create("token", null, "deck");
        },
        conditions: extra.conditions,
        steps: { after: log("after"), ...extra.steps },
        actions: {
          play: { execute: (tx: Tx<Types>) => void tx.move("card#0", "pile") },
          note: { execute: (tx: Tx<Types>) => void tx.vars.log.push("noted") },
          ...extra.actions,
        },
      } as never,
    }) as unknown as Game<Types>;

  const play = (g: ReturnType<typeof game>, action = "play") => {
    const r = init(g, { players: ["p1"], seed: "s" });
    return ok(apply(g, r.state, act(r.prompts[0]!, "p1", action)));
  };

  test("a matching event runs the trigger's flow before the interrupted node continues", () => {
    const g = game(
      [
        {
          id: "t",
          on: { type: "moved", to: "pile", entityType: "card" },
          when: "isTwo",
          flow: step("onPlay", "logEvent"),
        },
      ],
      {
        steps: { logEvent: steps.logEvent },
        conditions: {
          isTwo: (s, scope) =>
            scope.event?.type === "moved" &&
            (s.entity(scope.event.ids[0]!).props as { value?: number })
              .value === 2,
        },
      },
    );
    expect(play(g).state.vars.log).toEqual(["event moved", "after"]);
    // Vars changes never fire triggers
    expect(play(g, "note").state.vars.log).toEqual(["noted", "after"]);
  });

  test("priority, then declaration order; FIFO by default, LIFO reverses", () => {
    const defs: TriggerDef[] = [
      { id: "a", on: { type: "moved", to: "pile" }, flow: step("ta", "a") },
      { id: "b", on: { type: "moved", to: "pile" }, flow: step("tb", "b") },
      {
        id: "c",
        on: { type: "moved", to: "pile" },
        flow: step("tc", "c"),
        priority: 1,
      },
    ];
    const abc = { steps: { a: steps.a, b: steps.b, c: steps.c } };
    expect(play(game(defs, abc)).state.vars.log).toEqual([
      "c",
      "a",
      "b",
      "after",
    ]);
    expect(play(game(defs, abc, "lifo")).state.vars.log).toEqual([
      "b",
      "a",
      "c",
      "after",
    ]);
  });

  test("a trigger's own events can fire further triggers, which nest", () => {
    const g = game(
      [
        {
          id: "first",
          on: { type: "moved", entityType: "card" },
          flow: seq("t1", [step("mv", "moveToken"), step("t1a", "a")]),
        },
        {
          id: "second",
          on: { type: "moved", entityType: "token" },
          flow: step("t2", "b"),
        },
      ],
      { steps: { moveToken: steps.moveToken, a: steps.a, b: steps.b } },
    );
    expect(play(g).state.vars.log).toEqual(["b", "a", "after"]);
  });

  test("a trigger flow can wait on a prompt: a response window", () => {
    const g = game(
      [
        {
          id: "window",
          on: { type: "moved", to: "pile" },
          flow: decision("respond", { actor: "any" }, { respond: {} }),
        },
      ],
      { actions: { respond: { execute: log("responded") } } },
    );
    let r = play(g);
    expect(r.prompts.map((p) => p.node)).toEqual(["respond"]);
    r = ok(apply(g, r.state, act(r.prompts[0]!, "p1", "respond")));
    expect(r.state.vars.log).toEqual(["responded", "after"]);
  });

  // Entering a node and running its enter handler is one step, and triggers
  // are matched after each step: an enter trigger on a step runs after the
  // step's body, before the flow moves on
  test("flow enter events can fire triggers", () => {
    const g = game(
      [
        {
          id: "t",
          on: { type: "flow", kind: "enter", node: "after" },
          flow: step("onAfter", "logEvent"),
        },
      ],
      { steps: { logEvent: steps.logEvent } },
    );
    expect(play(g).state.vars.log).toEqual(["after", "event flow"]);
    expect(play(g).prompts.map((p) => p.node)).toEqual(["end"]);
  });

  test("trigger definitions are validated", () => {
    const bad = (t: TriggerDef) => () =>
      defineGame({
        spec: { ...base, flow: pause("p"), triggers: [t] },
        impl: { setup() {} } as never,
      });
    expect(
      bad({ id: "t", on: { type: "moved", to: "nowhere" }, flow: pause("x") }),
    ).toThrow(/unknown zone "nowhere"/);
    expect(
      bad({
        id: "t",
        on: { type: "flow", kind: "enter", node: "ghost" },
        flow: pause("x"),
      }),
    ).toThrow(/unknown node "ghost"/);
  });
});
