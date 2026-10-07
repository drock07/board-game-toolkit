// The turns reference's claims, checked.
import {
  actors,
  defaultNodes,
  define,
  init,
  RulesError,
  turnsNode,
  view,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { knock, knockout, wait } from "./flowTurns";

const players = ["p1", "p2", "p3"];

test("from, among and until, in play", () => {
  // #region play
  let state = init(knockout, { players, seed: "s" });
  // The dealer goes first, from `from`
  expect(actors(knockout, state)).toEqual(["p3"]);

  state = applyOrThrow(knockout, state, knock.by("p3", { target: "p1" }));
  // p1 is out, so `among` skips them: the second turn is p2's
  expect(actors(knockout, state)).toEqual(["p2"]);
  expect(turnsNode.shown(view(knockout, state, "p2"))).toEqual({
    player: "p2",
    turn: 2,
    round: 1,
  });

  state = applyOrThrow(knockout, state, wait.by("p2"));
  expect(turnsNode.shown(view(knockout, state, "p3"))?.round).toBe(2);

  // `until` holds before the next turn, so `turns` ends
  state = applyOrThrow(knockout, state, knock.by("p3", { target: "p2" }));
  expect(state.result).toEqual({ standing: ["p3"] });
  // #endregion play
});

test("rounds counts passes around the table", () => {
  let s = init(knockout, { players, seed: "s" });
  let turnsTaken = 0;
  while (s.status === "running") {
    s = applyOrThrow(knockout, s, wait.by(actors(knockout, s)[0]!));
    turnsTaken++;
  }
  expect(turnsTaken).toBe(9);
  expect(s.result).toEqual({ standing: players });
});

const { rules, action, seq, step, turns, prompt } = define<{
  log: string[];
}>().withNodes(defaultNodes);
const go = action("go", {
  execute: (tx, actor) => void tx.vars.log.push(actor),
});

test("counterclockwise goes back around from `from`", () => {
  const game = rules({
    players: 3,
    setup: (tx) => void (tx.vars = { log: [] }),
    flow: seq(
      turns(
        { order: "counterclockwise", from: () => "p2", rounds: 1 },
        prompt(go),
      ),
      step((tx) => tx.end(tx.vars.log)),
    ),
  });
  let s = init(game, { players, seed: "s" });
  while (s.status === "running")
    s = applyOrThrow(game, s, go.by(actors(game, s)[0]!));
  expect(s.result).toEqual(["p2", "p1", "p3"]);
});

test("an unknown `from` player is a RulesError; an empty `among` ends at once", () => {
  const bad = rules({
    players: 2,
    setup: (tx) => void (tx.vars = { log: [] }),
    flow: seq(
      turns({ from: () => "nobody" }, prompt(go)),
      step((tx) => tx.end()),
    ),
  });
  expect(() => init(bad, { players: ["p1", "p2"], seed: "s" })).toThrow(
    RulesError,
  );
  const none = rules({
    players: 2,
    setup: (tx) => void (tx.vars = { log: [] }),
    flow: seq(
      turns({ among: () => [] }, prompt(go)),
      step((tx) => tx.end("skipped")),
    ),
  });
  expect(init(none, { players: ["p1", "p2"], seed: "s" }).result).toBe(
    "skipped",
  );
});
