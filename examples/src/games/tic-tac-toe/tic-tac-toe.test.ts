import {
  actors,
  apply,
  init,
  legalInputs,
  randomBot,
  replayInputs,
  view,
  type State,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { again, minimaxBot, placeMark, ticTacToe } from ".";
import type { Vars } from "./game";

const players = ["p1", "p2"];
const mover = (s: State<Vars>) => actors(ticTacToe, s)[0]!;

/** Plays the given cells in turn order. */
function play(seed: string, cells: number[]) {
  let s = init(ticTacToe, { players, seed });
  for (const index of cells)
    s = applyOrThrow(ticTacToe, s, placeMark.by(mover(s), { index }));
  return s;
}

describe("tic-tac-toe", () => {
  test("a random, seeded player starts, and turns alternate", () => {
    const starters = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = init(ticTacToe, { players, seed: `s${i}` });
      const first = mover(s);
      starters.add(first);
      expect(mover(init(ticTacToe, { players, seed: `s${i}` }))).toBe(first);
      const next = applyOrThrow(
        ticTacToe,
        s,
        placeMark.by(first, { index: 4 }),
      );
      expect(actors(ticTacToe, next)).toEqual([first === "p1" ? "p2" : "p1"]);
    }
    expect(starters).toEqual(new Set(players));
  });

  test("only empty cells are legal; the other player can't move", () => {
    const s = play("a", [4]);
    const me = mover(s);
    const idle = me === "p1" ? "p2" : "p1";
    expect(legalInputs(ticTacToe, s, me).map((i) => i.args)).toEqual(
      [0, 1, 2, 3, 5, 6, 7, 8].map((index) => ({ index })),
    );
    expect(legalInputs(ticTacToe, s, idle)).toEqual([]);
    expect(apply(ticTacToe, s, placeMark.by(me, { index: 4 }))).toEqual({
      ok: false,
      reason: "Pick an empty cell",
    });
    const wrong = apply(ticTacToe, s, placeMark.by(idle, { index: 0 }));
    expect(wrong.ok || wrong.reason).toMatch(/turn/);
  });

  test("a line ends the game and is recorded", () => {
    // First mover takes the top row; the other plays 3 and 4
    const s = play("a", [0, 3, 1, 4, 2]);
    const winner = s.vars.winner!;
    expect(s.vars.line).toEqual([0, 1, 2]);
    expect(s.vars.wins[winner]).toBe(1);
    expect(view(ticTacToe, s, "p1").waiting).toEqual([
      { label: "Play again", actors: ["p1"] },
    ]);
  });

  test("a full board without a line is a tie; playing again clears the board", () => {
    let s = play("a", [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(s.vars).toMatchObject({
      winner: null,
      tie: true,
      line: null,
      ties: 1,
    });
    s = applyOrThrow(ticTacToe, s, again.by("p1"));
    expect(s.vars.marks.every((m) => m === null)).toBe(true);
    expect(legalInputs(ticTacToe, s, mover(s))[0]!.action).toBe("placeMark");
  });

  test("minimax never loses: against itself it always ties, and it beats or ties random play", () => {
    for (let i = 0; i < 20; i++) {
      const self = playBots(ticTacToe, {
        players,
        seed: `m${i}`,
        bots: minimaxBot,
        maxInputs: 9,
      });
      expect(self.states.at(-1)!.vars.tie).toBe(true);
      const mixed = playBots(ticTacToe, {
        players,
        seed: `r${i}`,
        bots: { p1: minimaxBot, p2: randomBot(`r${i}`) },
        maxInputs: 9,
      });
      expect(mixed.states.at(-1)!.vars.winner).not.toBe("p2");
    }
  });
});

test("golden replay", async () => {
  const { states, inputs } = playBots(ticTacToe, {
    players,
    seed: "golden",
    bots: { p1: minimaxBot, p2: randomBot("golden") },
    maxInputs: 60,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(ticTacToe, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
