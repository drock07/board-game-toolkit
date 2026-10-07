// The quickstart's test samples, run against the Tic-Tac-Toe example.
import {
  actors,
  init,
  legalInputs,
  view,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow, fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { placeMark, ticTacToe } from "../games/tic-tac-toe";

test("playing a few moves", () => {
  // #region play
  let state = init(ticTacToe, { players: ["p1", "p2"], seed: "first" });
  const first = actors(ticTacToe, state)[0]!; // a random, seeded starter

  state = applyOrThrow(ticTacToe, state, placeMark.by(first, { index: 4 }));
  expect(state.vars.marks[4]).toBe(first === "p1" ? "x" : "o");

  // Only the other player may move now, and only into empty cells
  const next = actors(ticTacToe, state)[0]!;
  expect(next).not.toBe(first);
  expect(legalInputs(ticTacToe, state, next)).toHaveLength(8);
  expect(view(ticTacToe, state, next).waiting).toEqual([
    { label: "Place a mark", actors: [next] },
  ]);
  // #endregion play
});

test("fuzzing", () => {
  // #region fuzz
  const report = fuzz(ticTacToe, {
    seeds: 200,
    players: ["p1", "p2"],
    maxInputs: 30,
  });
  expect(report.failures).toEqual([]);
  // #endregion fuzz
});
