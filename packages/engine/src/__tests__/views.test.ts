// What views say about the flow: `waiting` (open prompts, their labels and
// who they wait on) and `shown` (what kinds publish, read through their
// definitions, never from another player's fiber).
import { assert, test } from "vitest";
import {
  defaultNodes,
  define,
  init,
  turnNode,
  view,
  type TurnShown,
} from "../index.js";
import { applyOrThrow } from "../testing/index.js";
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
