// The flow reference pages' claims about the built-in nodes, checked
// against the demos and small games built here.
import {
  actors,
  defaultNodes,
  define,
  FlowEndedWithoutEndError,
  FlowStuckError,
  init,
  legalInputs,
  UnhandledOutcomeError,
  view,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { game as anyoneDemo } from "../demos/anyone";
import { game as everyoneDemo } from "../demos/everyone";
import { game as seqDemo } from "../demos/seq";
import { game as turnDemo } from "../demos/turn";

const {
  rules,
  action,
  loop,
  seq,
  step,
  branch,
  outcomes,
  prompt,
  turn,
  everyone,
  simultaneous,
} = define<{ log: string[] }>().withNodes(defaultNodes);
const setup = (tx: { vars: { log: string[] } }) => void (tx.vars = { log: [] });
const go = action("go", {
  execute: (tx, actor) => void tx.vars.log.push(actor),
});

test("builders lower to a plain spec, with their functions in the impl", () => {
  // #region spec
  expect(seqDemo.spec.flow).toEqual({
    kind: "loop",
    id: "loop",
    body: {
      kind: "seq",
      id: "seq",
      children: [
        { kind: "step", id: "step", run: "step" },
        { kind: "step", id: "step2", run: "step2" },
        { kind: "step", id: "step3", run: "step3" },
        {
          kind: "prompt",
          id: "prompt",
          label: "Next round",
          actions: ["next"],
        },
      ],
    },
  });
  expect(Object.keys(seqDemo.impl.steps)).toEqual(["step", "step2", "step3"]);
  // #endregion spec
});

test("everyone is simultaneous(prompt)", () => {
  const pick = action("pick", { execute: () => {} });
  // #region everyone
  const a = rules({
    players: 2,
    setup,
    flow: loop({}, everyone({ label: "Pick" }, pick)),
  });
  const b = rules({
    players: 2,
    setup,
    flow: loop({}, simultaneous(prompt({ label: "Pick" }, pick))),
  });
  expect(a.spec.flow).toEqual(b.spec.flow);
  // #endregion everyone
});

test("everyone waits on each player once, in any order", () => {
  const players = ["p1", "p2"];
  const pick = everyoneDemo.action("pick");
  let s = init(everyoneDemo, { players, seed: "s" });
  expect(view(everyoneDemo, s, "p1").waiting).toEqual([
    { label: "Pick a number", actors: ["p1"] },
    { label: "Pick a number", actors: ["p2"] },
  ]);
  s = applyOrThrow(everyoneDemo, s, pick.by("p2", { n: 3 }));
  expect(actors(everyoneDemo, s)).toEqual(["p1"]);
  expect(legalInputs(everyoneDemo, s, "p2")).toEqual([]);
  s = applyOrThrow(everyoneDemo, s, pick.by("p1", { n: 1 }));
  expect(s.vars.score).toEqual({ p1: 0, p2: 1 });
});

test("anyone: the first answer from any of `who` ends it", () => {
  const players = ["p1", "p2", "p3"];
  const grab = anyoneDemo.action("grab");
  let s = init(anyoneDemo, { players, seed: "s" });
  expect(actors(anyoneDemo, s)).toEqual(players);
  expect(view(anyoneDemo, s, "p1").waiting).toEqual([
    { label: "Grab the coin!", actors: players },
  ]);
  s = applyOrThrow(anyoneDemo, s, grab.by("p2"));
  expect(s.vars.coins).toEqual({ p1: 0, p2: 1, p3: 0 });
});

test("anyone: everyone in `who` is an actor, legal input or not; an empty `who` waits on no one", () => {
  const {
    rules: r,
    action: act,
    loop: lp,
    anyone,
  } = define<{
    turn: string;
    who: string[];
  }>().withNodes(defaultNodes);
  const claim = act("claim", {
    validate: (s, actor) => (actor === s.vars.turn ? true : "Not yours"),
    execute: () => {},
  });
  const game = r({
    players: 3,
    setup: (tx) => void (tx.vars = { turn: "p2", who: ["p1", "p2"] }),
    flow: lp({}, anyone({ who: (s) => [...s.vars.who] }, claim)),
  });
  const s = init(game, { players: ["p1", "p2", "p3"], seed: "s" });
  expect(actors(game, s)).toEqual(["p1", "p2"]);
  expect(legalInputs(game, s, "p1")).toEqual([]);
  expect(legalInputs(game, s, "p2")).toHaveLength(1);
  const empty = { ...s, vars: { ...s.vars, who: [] } };
  expect(actors(game, empty)).toEqual([]);
  expect(view(game, empty, "p1").waiting).toEqual([]);
});

test("turn: first, limits, end, and fresh counts each turn", () => {
  const draw = turnDemo.action("draw");
  const pass = turnDemo.action("pass");
  const offered = (s: ReturnType<typeof init>) => [
    ...new Set(legalInputs(turnDemo, s as never).map((i) => i.action)),
  ];
  let s = init(turnDemo, { players: ["p1"], seed: "s" });
  expect(offered(s)).toEqual(["draw"]);
  s = applyOrThrow(turnDemo, s, draw.by("p1"));
  expect(offered(s)).toEqual(["draw", "discard", "pass"]);
  s = applyOrThrow(turnDemo, s, draw.by("p1"));
  expect(offered(s)).toEqual(["discard", "pass"]);
  s = applyOrThrow(turnDemo, s, pass.by("p1"));
  expect(offered(s)).toEqual(["draw"]);
});

test("turn: `until` is checked on entry and after each answer", () => {
  const game = rules({
    players: 1,
    setup,
    flow: seq(
      turn({ until: () => true }, go),
      turn({ until: (s) => s.vars.log.length === 2 }, go),
      step((tx) => tx.end(tx.vars.log)),
    ),
  });
  let s = init(game, { players: ["p1"], seed: "s" });
  s = applyOrThrow(game, s, go.by("p1"));
  s = applyOrThrow(game, s, go.by("p1"));
  expect(s.result).toEqual(["p1", "p1"]);
});

test("prompt: with no turns above it, the first seat answers", () => {
  const game = rules({ players: 2, setup, flow: loop({}, prompt(go)) });
  expect(
    actors(game, init(game, { players: ["p1", "p2"], seed: "s" })),
  ).toEqual(["p1"]);
});

test("loop checks `until` before the first pass; a loop that never waits throws", () => {
  const skipped = rules({
    players: 1,
    setup,
    flow: seq(
      loop({ until: () => true }, prompt(go)),
      step((tx) => tx.end("skipped")),
    ),
  });
  expect(init(skipped, { players: ["p1"], seed: "s" }).result).toBe("skipped");
  const spin = rules({
    players: 1,
    setup,
    flow: loop(
      {},
      step(() => {}),
    ),
  });
  expect(() => init(spin, { players: ["p1"], seed: "s" })).toThrow(
    FlowStuckError,
  );
  const runsOut = rules({ players: 1, setup, flow: step(() => {}) });
  expect(() => init(runsOut, { players: ["p1"], seed: "s" })).toThrow(
    FlowEndedWithoutEndError,
  );
});

test("branch picks once, on entry; no match and no otherwise ends it", () => {
  const game = rules({
    players: 1,
    setup,
    flow: seq(
      branch([{ when: (s) => s.vars.log.length > 0, then: prompt(go) }]),
      branch(
        [
          {
            when: (s) => s.vars.log.length > 0,
            then: step((tx) => tx.end("first")),
          },
        ],
        prompt(go),
      ),
      branch([{ when: () => true, then: step((tx) => tx.end("second")) }]),
    ),
  });
  let s = init(game, { players: ["p1"], seed: "s" });
  // The first branch matched nothing; the second chose `otherwise` on entry
  s = applyOrThrow(game, s, go.by("p1"));
  expect(s.result).toBe("second");
});

test("outcomes: the first listed guard wins; unknown outcomes throw; a handler's outcome passes outward", () => {
  const raise = (exit: string) =>
    action(`raise-${exit}`, { execute: () => ({ exit }) });
  const both = rules({
    players: 1,
    setup,
    flow: seq(
      outcomes(
        {
          a: {
            when: (s) => s.vars.log.length > 0,
            then: step((tx) => tx.end("a")),
          },
          b: {
            when: (s) => s.vars.log.length > 0,
            then: step((tx) => tx.end("b")),
          },
        },
        loop({}, prompt(go)),
      ),
    ),
  });
  let s = init(both, { players: ["p1"], seed: "s" });
  s = applyOrThrow(both, s, go.by("p1"));
  expect(s.result).toBe("a");

  const stray = raise("nowhere");
  const unhandled = rules({ players: 1, setup, flow: loop({}, prompt(stray)) });
  expect(() =>
    applyOrThrow(
      unhandled,
      init(unhandled, { players: ["p1"], seed: "s" }),
      stray.by("p1"),
    ),
  ).toThrow(UnhandledOutcomeError);

  const inner = raise("x");
  const nested = rules({
    players: 1,
    setup,
    flow: outcomes(
      { x: { then: step((tx) => tx.end("outer")) } },
      outcomes(
        { x: { then: step(() => ({ exit: "x" })) } },
        loop({}, prompt(inner)),
      ),
    ),
  });
  s = init(nested, { players: ["p1"], seed: "s" });
  s = applyOrThrow(nested, s, inner.by("p1"));
  expect(s.result).toBe("outer");
});

test("simultaneous with a branch on s.actor asks only some players", () => {
  const game = rules({
    players: 3,
    setup: (tx) => void (tx.vars = { log: ["p2"] }),
    flow: loop(
      {},
      simultaneous(
        branch([
          { when: (s) => !s.vars.log.includes(s.actor!), then: prompt(go) },
        ]),
      ),
    ),
  });
  const s = init(game, { players: ["p1", "p2", "p3"], seed: "s" });
  expect(actors(game, s)).toEqual(["p1", "p3"]);
});
