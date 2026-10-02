import { describe, expect, test } from "vitest";
import { branch, decision, each, loop, pause, seq, step } from "./builders.js";
import { GameDefinitionError } from "./errors.js";
import { describeCond } from "./expr.js";
import { apply, defineGame, init } from "./game.js";
import type { GameImpl } from "./impl.js";
import type { GameSpec } from "./spec.js";
import type { Tx } from "./tx.js";
import type { AnyTypes, Input, Prompt } from "./types.js";

type Vars = { n: number; log: string[]; flag: boolean; label: string };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };
const mk = <const I extends GameImpl<Types>>(impl: I): NoInfer<I> => impl;

const base = {
  id: "expr",
  version: 1,
  players: { min: 2, max: 2 },
  zones: {
    deck: { visibility: "hidden" },
    hand: { perPlayer: true, visibility: "owner" },
  },
  vars: { n: {}, log: {}, flag: {}, label: {} },
} as const;
const setup = (tx: Tx<Types>) => {
  tx.vars = { n: 0, log: [], flag: false, label: "a" };
  for (let i = 0; i < 6; i++) tx.create("card", {}, "deck");
};
const go = (r: { prompts: Prompt[] }, action = "go"): Input => ({
  prompt: r.prompts[0]!.id,
  player: r.prompts[0]!.actors[0]!,
  action,
});

describe("expressions", () => {
  test("guards, until and branch conditions can be expressions", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: seq("game", [
          loop(
            "count",
            decision("bump", { actor: "p1" }, { go: {} }),
            // n >= 2, or the impl's flag condition
            {
              until: {
                or: [{ gte: [{ var: "vars.n" }, 2] }, { ref: "flagged" }],
              },
            },
          ),
          branch("which", [
            {
              when: { eq: [{ var: "vars.label" }, "a"] },
              then: step("isA", "logA"),
            },
          ]),
          pause("end"),
        ]),
      },
      impl: mk({
        setup,
        conditions: { flagged: (s) => s.vars.flag },
        steps: { logA: (tx) => void tx.vars.log.push("a") },
        actions: { go: { execute: (tx) => void tx.vars.n++ } },
      }),
    });
    let r = init(game, { players: ["p1", "p2"], seed: "s" });
    r = apply(game, r.state, go(r)) as typeof r;
    expect(r.prompts[0]!.node).toBe("bump");
    r = apply(game, r.state, go(r)) as typeof r;
    expect(r.prompts[0]!.node).toBe("end");
    expect(r.state.vars.log).toEqual(["a"]);
  });

  test("count reads zones, with $player bound by an each over players", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: seq("game", [
          each(
            "turns",
            { players: "clockwise" },
            seq("turn", [
              decision("draw", { actor: "current" }, { go: {} }),
              branch("check", [
                {
                  when: { gte: [{ count: "hand:$player" }, 2] },
                  then: step("record", "record"),
                },
              ]),
            ]),
            { until: { gte: [{ var: "vars.n" }, 1] }, repeat: true },
          ),
          pause("end"),
        ]),
      },
      impl: mk({
        setup,
        steps: {
          record(tx) {
            tx.vars.n++;
            tx.vars.log.push(tx.scope.player!);
          },
        },
        actions: {
          go: {
            execute: (tx) => void tx.moveTop("deck", `hand:${tx.scope.actor!}`),
          },
        },
      }),
    });
    let r = init(game, { players: ["p1", "p2"], seed: "s" });
    const actors: string[] = [];
    while (r.prompts[0]!.node === "draw") {
      actors.push(r.prompts[0]!.actors[0]!);
      r = apply(game, r.state, go(r)) as typeof r;
    }
    // p1's second card is the first hand of two
    expect(actors).toEqual(["p1", "p2", "p1"]);
    expect(r.state.vars.log).toEqual(["p1"]);
  });

  test("arithmetic and scope and local paths", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: seq("game", [
          decision(
            "turn",
            {
              actor: "p1",
              // local.tries + 1 > 2, i.e. ends on the second go
              endWhen: { gt: [{ add: [{ var: "local.tries" }, 1] }, 2] },
            },
            { go: { ends: false } },
            { locals: "fresh" },
          ),
          pause("end"),
        ]),
      },
      impl: mk({
        setup,
        locals: { fresh: () => ({ tries: 0 }) },
        actions: {
          go: {
            execute: (tx) => void tx.local<{ tries: number }>().tries++,
          },
        },
      }),
    });
    let r = init(game, { players: ["p1", "p2"], seed: "s" });
    r = apply(game, r.state, go(r)) as typeof r;
    expect(r.prompts[0]!.node).toBe("turn");
    r = apply(game, r.state, go(r)) as typeof r;
    expect(r.prompts[0]!.node).toBe("end");
  });

  test("a condition must evaluate to true or false", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop("l", decision("d", { actor: "p1" }, { go: {} }), {
          until: { add: [{ var: "vars.n" }, 1] },
        }),
      },
      impl: mk({ setup, actions: { go: { execute: () => {} } } }),
    });
    const r = init(game, { players: ["p1", "p2"], seed: "s" });
    expect(() => apply(game, r.state, go(r))).toThrow(/not true or false/);
  });

  test("ordering comparisons need numbers", () => {
    const game = defineGame({
      spec: {
        ...base,
        flow: loop("l", decision("d", { actor: "p1" }, { go: {} }), {
          until: { lt: [{ var: "vars.label" }, 1] },
        }),
      },
      impl: mk({ setup, actions: { go: { execute: () => {} } } }),
    });
    const r = init(game, { players: ["p1", "p2"], seed: "s" });
    expect(() => apply(game, r.state, go(r))).toThrow(/expected a number/);
  });
});

describe("expression checks at defineGame", () => {
  const define = (until: unknown) => () =>
    defineGame({
      spec: {
        ...base,
        flow: loop("l", decision("d", { actor: "p1" }, { go: {} }), {
          until: until as never,
        }),
      },
      impl: { setup, actions: { go: { execute: () => {} } } } as never,
    });

  test.each([
    [{ var: "state.x" }, /must start with vars\., local\. or scope\./],
    [{ var: "vars.missing" }, /undeclared var "missing"/],
    [{ var: "scope.whatever" }, /scope has player/],
    [{ count: "table" }, /unknown zone "table"/],
    [{ eq: [1] }, /eq takes two operands/],
    [{ and: [] }, /non-empty list/],
    [{ gt: [1, 2], lt: [1, 2] }, /exactly one operator/],
    [{ nope: 1 }, /exactly one operator/],
    [{ and: [true, { nope: 1 }] }, /until\.and\[1\]: an expression/],
  ])("rejects %j", (until, message) => {
    expect(define(until)).toThrow(GameDefinitionError);
    expect(define(until)).toThrow(message);
  });

  test("refs inside expressions must exist in the impl, and count as used", () => {
    expect(define({ not: { ref: "ghost" } })).toThrow(
      /Missing impl\.conditions\.ghost/,
    );
    expect(() =>
      defineGame({
        spec: {
          ...base,
          flow: loop("l", decision("d", { actor: "p1" }, { go: {} }), {
            until: { not: { ref: "ready" } },
          }),
        },
        impl: mk({
          setup,
          conditions: { ready: () => true },
          actions: { go: { execute: () => {} } },
        }),
      }),
    ).not.toThrow();
  });

  test("a ref inside an expression is checked against the impl's types", () => {
    const spec = {
      ...base,
      flow: loop("l", decision("d", { actor: "p1" }, { go: {} }), {
        until: {
          and: [{ ref: "ready" }, { eq: [{ var: "vars.label" }, "x"] }],
        },
      }),
    } as const satisfies GameSpec;
    expect(() =>
      defineGame({
        spec,
        // @ts-expect-error missing impl.conditions.ready
        impl: mk({ setup, actions: { go: { execute: () => {} } } }),
      }),
    ).toThrow(GameDefinitionError);
  });
});

test("describeCond prints expressions readably", () => {
  expect(describeCond("playerDead")).toBe("playerDead");
  expect(describeCond({ lte: [{ var: "vars.enemy.hp" }, 0] })).toBe(
    "vars.enemy.hp <= 0",
  );
  expect(
    describeCond({
      and: [
        { not: { ref: "wounded" } },
        { gte: [{ count: "hand:$player" }, { add: [{ var: "vars.n" }, 1] }] },
        { eq: [{ var: "vars.label" }, "a"] },
      ],
    }),
  ).toBe(
    'not wounded and (count(hand:$player) >= (vars.n + 1)) and (vars.label == "a")',
  );
});
