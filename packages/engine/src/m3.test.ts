import { describe, expect, test } from "vitest";
import { randomBot } from "./bots.js";
import { choose, decision, each, loop, pause, seq, step } from "./builders.js";
import { GameDefinitionError } from "./errors.js";
import type { Game } from "./game.js";
import {
  apply,
  defineGame,
  init,
  legalInputs,
  type ApplyResult,
} from "./game.js";
import type { GameImpl } from "./impl.js";
import type { Json } from "./json.js";
import { fuzz, playBots } from "./testing/fuzz.js";
import type { Tx } from "./tx.js";
import type { AnyTypes, Input, Prompt } from "./types.js";

type Vars = { log: string[]; picked: Json[]; queue: string[] };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };
const mk = <const I extends GameImpl<Types>>(impl: I): NoInfer<I> => impl;

const base = {
  id: "m3",
  version: 1,
  players: { min: 1, max: 4 },
  zones: {},
} as const;

const setup = (tx: Tx<Types>) => {
  tx.vars = { log: [], picked: [], queue: ["a", "b", "c"] };
};

function ok<R>(res: R): Extract<R, { ok: true }> {
  const r = res as { ok: boolean; error?: unknown };
  if (!r.ok) throw new Error(`apply failed: ${JSON.stringify(r.error)}`);
  return res as Extract<R, { ok: true }>;
}

const only = (r: { prompts: Prompt[] }) => {
  expect(r.prompts).toHaveLength(1);
  return r.prompts[0]!;
};
const act = (p: Prompt, player: string, action: string, args?: Json): Input =>
  args === undefined
    ? { prompt: p.id, player, action }
    : { prompt: p.id, player, action, args };

/** Answers every prompt with its first actor's `go` action until `limit` inputs. */
function goAround(
  game: Game<Types>,
  players: string[],
  limit: number,
  seed = "s",
) {
  let r: ApplyResult<Types> = init(game, { players, seed });
  const actors: string[] = [];
  for (let i = 0; i < limit && r.prompts[0]?.node === "turn"; i++) {
    const p = only(r);
    actors.push(p.actors.join("|"));
    r = ok(apply(game, r.state, act(p, p.actors[0]!, "go")));
  }
  return { r, actors };
}

describe("each over players", () => {
  // `until` stops after five turns; without `repeat`, one pass ends sooner
  const turnGame = (over: Parameters<typeof each>[1], repeat = false) =>
    defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            each(
              "turns",
              over,
              decision("turn", { actor: "current" }, { go: {} }),
              {
                until: "fiveTurns",
                repeat,
              },
            ),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup,
        actions: {
          go: { execute: (tx) => void tx.vars.log.push(tx.scope.actor!) },
        },
        conditions: { fiveTurns: (s) => s.vars.log.length >= 5 },
      }),
    });

  test("clockwise from the first seat binds `current` for each player in turn", () => {
    const { actors } = goAround(
      turnGame({ players: "clockwise" }),
      ["p1", "p2", "p3"],
      3,
    );
    expect(actors).toEqual(["p1", "p2", "p3"]);
  });

  test("counterclockwise goes the other way round", () => {
    const { actors } = goAround(
      turnGame({ players: "counterclockwise" }),
      ["p1", "p2", "p3"],
      3,
    );
    expect(actors).toEqual(["p1", "p3", "p2"]);
  });

  test("from random is seeded, and keeps seat order from the chosen player", () => {
    const game = turnGame({ players: "clockwise", from: "random" });
    const starts = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const { actors } = goAround(game, ["p1", "p2", "p3"], 3, `seed-${i}`);
      const order = ["p1", "p2", "p3"];
      const at = order.indexOf(actors[0]!);
      expect(actors).toEqual([...order.slice(at), ...order.slice(0, at)]);
      starts.add(actors[0]!);
      // Same seed, same start
      expect(goAround(game, ["p1", "p2", "p3"], 1, `seed-${i}`).actors).toEqual(
        [actors[0]],
      );
    }
    expect(starts.size).toBe(3);
  });

  test("repeat goes around until `until` holds, checked after each turn", () => {
    const { r, actors } = goAround(
      turnGame({ players: "clockwise" }, true),
      ["p1", "p2"],
      10,
    );
    expect(actors).toEqual(["p1", "p2", "p1", "p2", "p1"]);
    expect(only(r).node).toBe("end");
  });
});

describe("each over a list", () => {
  test("binds scope.item, and repeat recomputes the list each pass", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          seq("game", [
            each("items", { ref: "queue" }, step("visit", "visit"), {
              repeat: true,
            }),
            pause("end"),
          ]),
        ),
      },
      impl: mk({
        setup,
        lists: { queue: (s) => [...s.vars.queue] },
        steps: {
          // Each visit logs the item and drops the first of the queue
          visit(tx) {
            tx.vars.log.push(tx.scope.item as string);
            tx.vars.queue.shift();
          },
        },
      }),
    });
    const r = init(game, { players: ["p1"], seed: "s" });
    // Pass 1 sees [a, b, c]; pass 2 sees [] and ends
    expect(r.state.vars.log).toEqual(["a", "b", "c"]);
    expect(only(r).node).toBe("end");
  });
});

describe("choose", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        seq("game", [
          choose("one", { actor: "any", options: "colors", apply: "record" }),
          choose("some", {
            actor: "p1",
            options: [1, 2, 3],
            min: 0,
            max: 2,
            apply: "record",
          }),
        ]),
      ),
    },
    impl: mk({
      setup,
      lists: { colors: () => ["red", "blue"] },
      choices: {
        record: (tx, selection) => void tx.vars.picked.push(selection),
      },
    }),
  });

  test("prompts list the options; a valid selection is applied", () => {
    let r = init(game, { players: ["p1", "p2"], seed: "s" });
    expect(only(r)).toMatchObject({
      kind: "choose",
      node: "one",
      options: ["red", "blue"],
      min: 1,
      max: 1,
      actors: ["p1", "p2"],
    });
    r = ok(
      apply(game, r.state, {
        prompt: only(r).id,
        player: "p2",
        choose: ["blue"],
      }),
    );
    expect(only(r)).toMatchObject({ node: "some", min: 0, max: 2 });
    r = ok(
      apply(game, r.state, {
        prompt: only(r).id,
        player: "p1",
        choose: [3, 1],
      }),
    );
    expect(r.state.vars.picked).toEqual([["blue"], [3, 1]]);
  });

  test("bad selections are rejected", () => {
    const r = init(game, { players: ["p1"], seed: "s" });
    const p = only(r);
    for (const choose of [[], ["green"], ["red", "blue"]]) {
      expect(
        apply(game, r.state, { prompt: p.id, player: "p1", choose }),
      ).toMatchObject({
        ok: false,
        error: { code: "bad_selection" },
      });
    }
    const next = ok(
      apply(game, r.state, { prompt: p.id, player: "p1", choose: ["red"] }),
    );
    const q = only(next);
    expect(
      apply(game, next.state, { prompt: q.id, player: "p1", choose: [2, 2] }),
    ).toMatchObject({
      ok: false,
      error: { code: "bad_selection" },
    });
    expect(
      apply(game, next.state, { prompt: q.id, player: "p1", action: "x" }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid_args" },
    });
  });

  test("legal selections are every subset sized min..max", () => {
    let r = init(game, { players: ["p1"], seed: "s" });
    expect(
      legalInputs(game, r.state, "p1").map((i) =>
        "choose" in i ? i.choose : null,
      ),
    ).toEqual([["red"], ["blue"]]);
    r = ok(
      apply(game, r.state, {
        prompt: only(r).id,
        player: "p1",
        choose: ["red"],
      }),
    );
    expect(
      legalInputs(game, r.state, "p1").map((i) =>
        "choose" in i ? i.choose : null,
      ),
    ).toEqual([[], [1], [1, 2], [1, 3], [2], [2, 3], [3]]);
  });
});

describe("legalInputs for decisions", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        decision(
          "turn",
          { actor: "p1" },
          { take: { ends: false }, done: {}, never: {} },
        ),
      ),
    },
    impl: mk({
      setup,
      actions: {
        take: {
          enumerate: () => [{ n: 1 }, { n: 2 }, { n: 3 }],
          validate: (_s, args: { n: number }) =>
            args.n !== 2 ? true : "not 2",
          execute: (tx, args: { n: number }) =>
            void tx.vars.log.push(String(args.n)),
        },
        done: { execute: () => {} },
        never: { validate: () => "nope", execute: () => {} },
      },
    }),
  });

  test("enumerated args are filtered by validate; no-arg actions are offered bare", () => {
    const r = init(game, { players: ["p1", "p2"], seed: "s" });
    const q = only(r).id;
    expect(legalInputs(game, r.state, "p1")).toEqual([
      { prompt: q, player: "p1", action: "take", args: { n: 1 } },
      { prompt: q, player: "p1", action: "take", args: { n: 3 } },
      { prompt: q, player: "p1", action: "done" },
    ]);
    expect(legalInputs(game, r.state, "p2")).toEqual([]);
  });
});

describe("definition checks", () => {
  test("current outside an each over players, bad choose bounds and a repeating parallel each are rejected", () => {
    const run = (flow: Parameters<typeof loop>[1]) => () =>
      defineGame({
        spec: { ...base, flow: loop("l", flow) },
        impl: { setup() {} } as never,
      });
    expect(run(decision("d", { actor: "current" }, { go: {} }))).toThrow(
      /outside an each over players/,
    );
    expect(
      run(
        choose("c", { actor: "any", options: [1], min: 2, max: 1, apply: "a" }),
      ),
    ).toThrow(/min <= max/);
    expect(
      run(
        each("e", { players: "clockwise" }, pause("p"), {
          mode: "parallel",
          repeat: true,
        }),
      ),
    ).toThrow(/only apply in sequential mode/);
    expect(
      run(
        each(
          "e",
          { players: "clockwise" },
          decision("d", { actor: "current" }, { go: {} }),
          { on: { x: decision("after", { actor: "current" }, { go: {} }) } },
        ),
      ),
    ).toThrow(/"after" uses actor "current"/);
    expect(run(pause("p"))).not.toThrow(GameDefinitionError);
  });
});

describe("bots and the fuzzer", () => {
  const game = defineGame({
    spec: {
      ...base,
      flow: loop(
        "session",
        seq("game", [
          each(
            "turns",
            { players: "clockwise" },
            decision("turn", { actor: "current" }, { take: {} }),
            {
              repeat: true,
              until: "long",
            },
          ),
          step("end", "end"),
        ]),
      ),
    },
    impl: mk({
      setup,
      conditions: { long: (s) => s.vars.log.length >= 6 },
      steps: { end: (tx) => tx.end(null) },
      actions: {
        take: {
          enumerate: () => ["x", "y"],
          execute: (tx, args: string) => void tx.vars.log.push(args),
        },
      },
    }),
  });

  test("playBots plays a game to the end with random bots", () => {
    const { results, inputs } = playBots(game, {
      players: ["p1", "p2"],
      seed: "s",
      bots: randomBot(),
      maxInputs: 50,
    });
    expect(inputs).toHaveLength(6);
    expect(results.at(-1)!.state.status).toBe("finished");
  });

  test("a sound game fuzzes clean", () => {
    const report = fuzz(game, {
      seeds: 50,
      maxInputs: 20,
      players: ["p1", "p2"],
    });
    expect(report.failures).toEqual([]);
    expect(report.finished).toBe(50);
  });

  test("the fuzzer reports thrown errors and dead ends with the seed", () => {
    const broken = defineGame({
      spec: {
        ...base,
        flow: loop(
          "session",
          decision(
            "turn",
            { actor: "p1" },
            { boom: { ends: false }, stuck: { ends: false } },
          ),
        ),
      },
      impl: mk({
        setup,
        actions: {
          boom: {
            enumerate: () => [1, 2],
            validate: (s) => (s.vars.log.length < 2 ? true : "no more"),
            execute(tx, n: number) {
              if (n === 2 && tx.vars.log.length === 1)
                throw new Error("bad state");
              tx.vars.log.push(String(n));
            },
          },
          stuck: { validate: () => "never", execute: () => {} },
        },
      }),
    });
    const report = fuzz(broken, { seeds: 20, maxInputs: 10, players: ["p1"] });
    const messages = report.failures.map((f) => f.message);
    expect(messages.some((m) => m.includes("bad state"))).toBe(true);
    expect(messages.some((m) => m.includes("no legal inputs"))).toBe(true);
    expect(report.failures[0]).toMatchObject({
      seed: expect.stringMatching(/^fuzz-/) as unknown,
    });
    expect(report.warnings).toEqual([
      "impl.actions.stuck was never legal without args; if it takes args, give it enumerate",
    ]);
  });
});
