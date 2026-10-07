// The Testing guide's samples: scripting a game, recording and checking a
// golden replay, and what fuzz reports when a rule is wrong.
import {
  actors,
  defaultNodes,
  define,
  legalInputs,
  replayInputs,
} from "@drock07/board-game-toolkit-engine";
import {
  fuzz,
  hashState,
  record,
  simulate,
} from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { placeMark, ticTacToe } from "../games/tic-tac-toe";

test("simulate plays a script and returns every state", () => {
  // #region simulate
  // With seed "b", p1 starts; p1 takes the top row while p2 plays 3 and 4
  const states = simulate(ticTacToe, {
    players: ["p1", "p2"],
    seed: "b",
    inputs: [0, 3, 1, 4, 2].map((index, i) =>
      placeMark.by(i % 2 ? "p2" : "p1", { index }),
    ),
  });
  const end = states.at(-1)!;
  expect(end.vars.winner).toBe("p1");
  expect(end.vars.line).toEqual([0, 1, 2]);
  // #endregion simulate
  expect(actors(ticTacToe, states[0]!)).toEqual(["p1"]);
  expect(states).toHaveLength(6);
});

test("record makes a golden replay, and replaying it reaches the same hash", () => {
  // #region record
  const { golden } = record(
    ticTacToe,
    { players: ["p1", "p2"], seed: "golden", maxInputs: 9 },
    // Each step, the first legal input of whoever may act
    (state) => legalInputs(ticTacToe, state)[0],
  );
  // golden: { players, seed, inputs, finalStateHash }, ready to commit as JSON

  // Later, in CI: the same inputs must reach the same state
  const replayed = replayInputs(ticTacToe, golden, golden.inputs);
  expect(hashState(replayed)).toBe(golden.finalStateHash);
  // #endregion record
  expect(golden.inputs.length).toBeGreaterThan(4);
});

test("fuzz reports a game where nobody can act", () => {
  // #region broken
  const { rules, action, loop, prompt } = define<{ total: number }>().withNodes(
    defaultNodes,
  );
  // A bug: once the total reaches 10 nothing is legal, but the game goes on
  const add = action("add", {
    enumerate: () => [1, 2, 3].map((n) => ({ n })),
    validate: (s, { n }) => (s.vars.total + n <= 10 ? true : "Too much"),
    execute: (tx, { n }) => void (tx.vars.total += n),
  });
  const stuck = rules({
    players: 1,
    setup: (tx) => void (tx.vars = { total: 0 }),
    flow: loop({}, prompt(add)),
  });

  const report = fuzz(stuck, { seeds: 20, players: ["p1"], maxInputs: 50 });
  report.failures[0]; // { seed: "fuzz-0", step: …, message: "No legal input" }
  // #endregion broken
  expect(report.failures).toHaveLength(20);
  expect(report.failures[0]!.message).toBe("No legal input");
  expect(report.finished).toBe(0);
});
