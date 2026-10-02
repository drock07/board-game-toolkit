import {
  apply,
  init,
  legalInputs,
  randomBot,
  replay,
  type ApplyResult,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import {
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { minimaxBot, ticTacToe } from ".";
import type { Types } from "./impl";

type Result = ApplyResult<Types>;
const players = ["p1", "p2"];

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const place = (
  r: Result,
  index: number,
  player = r.prompts[0]!.actors[0]!,
): Input => ({
  prompt: r.prompts[0]!.id,
  player,
  action: "placeMark",
  args: { index },
});

/** Plays the given cells in turn order. */
function play(seed: string, cells: number[]) {
  let r = init(ticTacToe, { players, seed });
  for (const cell of cells) r = ok(apply(ticTacToe, r.state, place(r, cell)));
  return r;
}

describe("tic-tac-toe", () => {
  test("a random, seeded player starts, and turns alternate", () => {
    const starters = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = init(ticTacToe, { players, seed: `s${i}` });
      const first = r.prompts[0]!.actors[0]!;
      starters.add(first);
      expect(
        init(ticTacToe, { players, seed: `s${i}` }).prompts[0]!.actors,
      ).toEqual([first]);
      const next = ok(apply(ticTacToe, r.state, place(r, 4)));
      expect(next.prompts[0]!.actors).toEqual([first === "p1" ? "p2" : "p1"]);
    }
    expect(starters).toEqual(new Set(players));
  });

  test("only empty cells are legal; the other player can't move", () => {
    const r = play("a", [4]);
    const mover = r.prompts[0]!.actors[0]!;
    const idle = mover === "p1" ? "p2" : "p1";
    expect(
      legalInputs(ticTacToe, r.state, mover).map((i) =>
        "args" in i ? i.args : null,
      ),
    ).toEqual([0, 1, 2, 3, 5, 6, 7, 8].map((index) => ({ index })));
    expect(legalInputs(ticTacToe, r.state, idle)).toEqual([]);
    expect(apply(ticTacToe, r.state, place(r, 4))).toMatchObject({
      ok: false,
      error: { message: "Pick an empty cell" },
    });
    expect(apply(ticTacToe, r.state, place(r, 0, idle))).toMatchObject({
      ok: false,
      error: { code: "not_actor" },
    });
  });

  test("a line ends the game and is recorded", () => {
    // First mover takes the top row; the other plays 3 and 4
    const r = play("a", [0, 3, 1, 4, 2]);
    const winner = r.state.vars.winner!;
    expect(r.state.vars.line).toEqual([0, 1, 2]);
    expect(r.state.vars.wins[winner]).toBe(1);
    expect(r.prompts[0]).toMatchObject({ node: "again", kind: "pause" });
  });

  test("a full board without a line is a tie; playing again clears the board", () => {
    let r = play("a", [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(r.state.vars).toMatchObject({
      winner: null,
      tie: true,
      line: null,
      ties: 1,
    });
    r = ok(
      apply(ticTacToe, r.state, {
        prompt: r.prompts[0]!.id,
        player: "p2",
        continue: true,
      }),
    );
    expect(r.state.vars.marks.every((m) => m === null)).toBe(true);
    expect(r.prompts[0]!.node).toBe("place");
  });

  test("minimax never loses: against itself it always ties, and it beats or ties random play", () => {
    for (let i = 0; i < 20; i++) {
      const self = playBots(ticTacToe, {
        players,
        seed: `m${i}`,
        bots: minimaxBot,
        maxInputs: 9,
      });
      expect(self.results.at(-1)!.state.vars.tie).toBe(true);
      const mixed = playBots(ticTacToe, {
        players,
        seed: `r${i}`,
        bots: { p1: minimaxBot, p2: randomBot() },
        maxInputs: 9,
      });
      expect(mixed.results.at(-1)!.state.vars.winner).not.toBe("p2");
    }
  });
});

test("golden replay", async () => {
  const { results, inputs } = playBots(ticTacToe, {
    players,
    seed: "golden",
    bots: { p1: minimaxBot, p2: randomBot() },
    maxInputs: 60,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  expect(hashState(replay(ticTacToe, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
