// Code from the Quickstart, run as tests so the page can't go stale.
import {
  apply,
  init,
  legalInputs,
  randomBot,
} from "@drock07/board-game-toolkit-engine";
import { fuzz, playBots } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { ticTacToe } from "../games/tic-tac-toe";

test("play a few moves without a UI", () => {
  // #region play
  // Start a game: setup runs, and the flow runs until it needs input
  const start = init(ticTacToe, { players: ["alice", "bob"], seed: "demo" });
  const [prompt] = start.prompts;
  // prompt: { id: "q1", node: "place", kind: "decision", actors: [...], ... }

  // Answer it: the player in `actors` places a mark in the center
  const next = apply(ticTacToe, start.state, {
    prompt: prompt!.id,
    player: prompt!.actors[0]!,
    action: "placeMark",
    args: { index: 4 },
  });
  if (!next.ok) throw new Error(next.error.message);
  // next.state.vars.marks[4] is now "x" or "o", and next.events lists
  // everything that happened; the next prompt is for the other player

  // An illegal input is rejected, and the state is untouched
  const again = apply(ticTacToe, next.state, {
    prompt: next.prompts[0]!.id,
    player: next.prompts[0]!.actors[0]!,
    action: "placeMark",
    args: { index: 4 },
  });
  // again: { ok: false, error: { code: "validation_failed", message: "Pick an empty cell" } }
  // #endregion play

  expect(prompt!.node).toBe("place");
  expect(prompt!.id).toBe("q1");
  expect(next.state.vars.marks[4]).not.toBeNull();
  expect(next.prompts[0]!.actors).not.toEqual(prompt!.actors);
  expect(again).toEqual({
    ok: false,
    error: { code: "validation_failed", message: "Pick an empty cell" },
  });
  // #region legal
  // Every move the player could make now, from each action's `enumerate`
  const moves = legalInputs(ticTacToe, next.state, next.prompts[0]!.actors[0]!);
  // 8 inputs: one placeMark per empty cell
  // #endregion legal
  expect(moves).toHaveLength(8);
});

test("bots play a whole game", () => {
  // #region bots
  const { results } = playBots(ticTacToe, {
    players: ["alice", "bob"],
    seed: "demo",
    bots: randomBot(),
    maxInputs: 9,
  });
  // The first result waiting on "Play again" has the finished board
  const over = results.find((r) => r.prompts[0]?.node === "again")!;
  // over.state.vars.winner is a player, or over.state.vars.tie is true
  // #endregion bots
  expect(over.state.vars.winner !== null || over.state.vars.tie).toBe(true);
});

test("fuzz the rules", () => {
  // #region fuzz
  const report = fuzz(ticTacToe, {
    seeds: 50,
    maxInputs: 30,
    players: ["alice", "bob"],
  });
  expect(report.failures).toEqual([]);
  // #endregion fuzz
});
