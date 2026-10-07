// What views say about the flow: `waiting` (open prompts, their labels and
// who they wait on) and `shown` (what kinds publish, read through their
// definitions, never from another player's fiber).
import { assert, expect, test } from "vitest";
import {
  apply,
  defaultNodes,
  define,
  init,
  legalInputs,
  loopNode,
  replay,
  turnNode,
  turnsNode,
  view,
  viewEvents,
  type GameInput,
  type TurnShown,
} from "../index.js";
import { applyOrThrow, playBots, type SyncBot } from "../testing/index.js";
import { blackjackAtOnce } from "./blackjackAtOnce.js";
import { rollFive } from "./rollFive.js";

test("a turn's counts are shown to every player, typed by the turn's definition", () => {
  const players = ["ann", "bob"];
  let s = init(rollFive, { players, seed: "v" });
  const before: TurnShown | undefined = turnNode.shown(
    view(rollFive, s, "bob"),
  );
  assert.deepEqual(before, { answers: 0, counts: {} });
  s = applyOrThrow(rollFive, s, rollFive.action("roll").by("ann"));
  for (const p of [...players, "spectator"])
    assert.strictEqual(turnNode.shown(view(rollFive, s, p))?.counts.roll, 1);
});

test("another player's fiber isn't shown: each sees their own turn", () => {
  let s = init(blackjackAtOnce, { players: ["ann", "bob"], seed: "v" });
  s = applyOrThrow(blackjackAtOnce, s, blackjackAtOnce.action("hit").by("ann"));
  // ann may have bust and finished her turn; bob's turn is untouched either way
  assert.deepEqual(turnNode.shown(view(blackjackAtOnce, s, "bob")), {
    answers: 0,
    counts: {},
  });
  const ann = turnNode.shown(view(blackjackAtOnce, s, "ann"));
  assert.ok(ann === undefined || ann.counts.hit === 1);
  assert.strictEqual(
    turnNode.shown(view(blackjackAtOnce, s, "spectator")),
    undefined,
    "a spectator owns no fiber",
  );
});

interface Vars {
  log: string[];
}
const { rules, action, seq, step, prompt, everyone, anyone, turn } =
  define<Vars>().withNodes(defaultNodes);
const note = <N extends string>(name: N) =>
  action(name, {
    execute: (tx, actor) => void tx.vars.log.push(`${actor} ${name}`),
  });
const labelled = rules({
  players: 2,
  setup: (tx) => void (tx.vars = { log: [] }),
  flow: seq(
    everyone({ label: "Choose a bid" }, note("bid")),
    anyone({ label: "Grab it", who: (s) => [s.players[1]!] }, note("grab")),
    prompt(note("go")),
    turn({ label: "Take a turn" }, action("done", { execute: () => "end" })),
    step((tx) => tx.end()),
  ),
});

test("waiting lists each open prompt with its label and who it waits on", () => {
  const w = (s: ReturnType<typeof init<Vars, unknown>>) =>
    view(labelled, s, "spectator").waiting;
  let s = init(labelled, { players: ["ann", "bob"], seed: "w" });
  assert.deepEqual(w(s), [
    { label: "Choose a bid", actors: ["ann"] },
    { label: "Choose a bid", actors: ["bob"] },
  ]);
  s = applyOrThrow(labelled, s, labelled.action("bid").by("bob"));
  assert.deepEqual(w(s), [{ label: "Choose a bid", actors: ["ann"] }]);
  s = applyOrThrow(labelled, s, labelled.action("bid").by("ann"));
  assert.deepEqual(w(s), [{ label: "Grab it", actors: ["bob"] }]);
  s = applyOrThrow(labelled, s, labelled.action("grab").by("bob"));
  assert.deepEqual(w(s), [{ actors: ["ann"] }], "no label, no label field");
  s = applyOrThrow(labelled, s, labelled.action("go").by("ann"));
  assert.deepEqual(w(s), [{ label: "Take a turn", actors: ["ann"] }]);
  s = applyOrThrow(labelled, s, labelled.action("done").by("ann"));
  assert.strictEqual(s.status, "finished");
  assert.deepEqual(w(s), []);
});

test("rules code reads what kinds show too: an action legal only after two taps", () => {
  const { rules, action, step, seq, turn } = define<{ n: number }>().withNodes(
    defaultNodes,
  );
  const tap = action("tap", { execute: () => {} });
  const cash = action("cash", {
    // A `turn`'s counts, read through its definition, as a view would
    validate: (s) =>
      (turnNode.shown(s)?.counts.tap ?? 0) >= 2 ? true : "Tap twice first",
    execute: () => "end",
  });
  const game = rules({
    players: 1,
    setup: (tx) => void (tx.vars = { n: 0 }),
    flow: seq(
      turn({}, tap, cash),
      step((tx) => tx.end()),
    ),
  });
  let s = init(game, { players: ["ann"], seed: "x" });
  const names = () => legalInputs(game, s, "ann").map((i) => i.action);
  expect(names()).toEqual(["tap"]);
  s = applyOrThrow(game, s, tap.by("ann"));
  expect(names()).toEqual(["tap"]);
  s = applyOrThrow(game, s, tap.by("ann"));
  expect(names()).toEqual(["tap", "cash"]);
});

test("playBots skips a bot seat with nothing to answer in an anyone window", () => {
  const { rules, action, anyone, step, seq } = define<{
    by: string;
  }>().withNodes(defaultNodes);
  const claim = action("claim", {
    validate: (_s, actor) => (actor === "bob" ? true : "Only bob may claim"),
    execute: (tx, actor) => void (tx.vars.by = actor),
  });
  const game = rules({
    players: 2,
    setup: (tx) => void (tx.vars = { by: "" }),
    flow: seq(
      anyone({}, claim),
      step((tx) => tx.end()),
    ),
  });
  const pick: SyncBot<{ by: string }, GameInput<typeof game>> = (legal) =>
    legal[0]!;
  const { states, inputs } = playBots(game, {
    players: ["ann", "bob"],
    seed: "x",
    bots: pick,
    maxInputs: 5,
  });
  expect(inputs).toEqual([claim.by("bob")]);
  expect(states.at(-1)!.status).toBe("finished");
});

test("turns and loop show their counters: whose turn, which turn and round, which pass", () => {
  const players = ["ann", "bob"];
  let s = init(rollFive, { players, seed: "c" });
  const at = () => turnsNode.shown(view(rollFive, s, "bob"));
  expect(at()).toEqual({ player: "ann", turn: 1, round: 1 });
  const turnOf = (p: string) => {
    s = applyOrThrow(rollFive, s, rollFive.action("roll").by(p));
    s = applyOrThrow(
      rollFive,
      s,
      legalInputs(rollFive, s, p).find((i) => i.action === "score")!,
    );
  };
  turnOf("ann");
  expect(at()).toEqual({ player: "bob", turn: 2, round: 1 });
  turnOf("bob");
  expect(at()).toEqual({ player: "ann", turn: 3, round: 2 });
  expect(loopNode.shown(view(rollFive, s, "bob"))).toBeUndefined();
});

test("a flow event updates each player's view as it plays back, so views replay exactly", () => {
  const players = ["ann", "bob"];
  const s = init(rollFive, { players, seed: "f" });
  const out = apply(rollFive, s, rollFive.action("roll").by("ann"));
  assert.ok(out.ok);
  const mine = viewEvents(rollFive, out.events, "bob");
  const flow = mine.find((e) => e.type === "flow");
  assert.ok(flow?.type === "flow");
  expect((flow.shown.turn as TurnShown).counts.roll).toBe(1);
  expect(replay(view(rollFive, s, "bob"), mine)).toEqual(
    view(rollFive, out.state, "bob"),
  );
});

test("a loop shows which pass it's on", () => {
  const { rules, action, loop, prompt } = define<{ n: number }>().withNodes(
    defaultNodes,
  );
  const tap = action("tap", { execute: () => {} });
  const game = rules({
    players: 1,
    setup: (tx) => void (tx.vars = { n: 0 }),
    flow: loop({}, prompt(tap)),
  });
  let s = init(game, { players: ["ann"], seed: "x" });
  expect(loopNode.shown(view(game, s, "ann"))).toEqual({ pass: 1 });
  s = applyOrThrow(game, s, tap.by("ann"));
  s = applyOrThrow(game, s, tap.by("ann"));
  expect(loopNode.shown(view(game, s, "ann"))).toEqual({ pass: 3 });
});
