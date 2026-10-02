// Code from the Guides, run as tests so the pages can't go stale.
import {
  apply,
  init,
  legalInputs,
  randomBot,
  replay,
  seededRandom,
  type ApplyResult,
  type Bot,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import {
  checkInvariants,
  expectPrompt,
  hashState,
  playBots,
  record,
  simulate,
  transact,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { blackjack } from "../games/blackjack";
import { impl as blackjackImpl } from "../games/blackjack/impl";
import { ticTacToe } from "../games/tic-tac-toe";
import type { Types as TicTacToeTypes } from "../games/tic-tac-toe/impl";
import { GameRoom } from "./server";

describe("bots", () => {
  // #region centerBot
  /** Takes the center if it's free, otherwise any legal move. */
  const centerBot: Bot<TicTacToeTypes> = (view, prompt, { legal, random }) => {
    if (prompt.node === "place" && view.vars.marks?.[4] === null) {
      const center = legal.find(
        (i) => "args" in i && (i.args as { index: number }).index === 4,
      );
      if (center) return center;
    }
    return random.pick(legal);
  };
  // #endregion centerBot

  test("the center bot takes the center", () => {
    // #region playBots
    const { results } = playBots(ticTacToe, {
      players: ["p1", "p2"],
      seed: "bots",
      bots: { p1: centerBot, p2: randomBot() },
      maxInputs: 20,
    });
    // #endregion playBots
    const firstMarks = results
      .map((r) => r.state.vars.marks.filter(Boolean).length)
      .indexOf(1);
    expect(firstMarks).toBeGreaterThan(0);
  });
});

describe("testing", () => {
  test("a rule in isolation", () => {
    // #region unit
    // Set up a state, run one rule in a transaction, check the result
    const { state } = init(blackjack, { players: ["p1"], seed: "unit" });
    const { state: next, events } = transact(state, (tx) =>
      blackjackImpl.steps.dealInitial(tx),
    );
    expect(next.zones.player.items).toHaveLength(2);
    expect(next.zones.dealer.items).toHaveLength(2);
    // The hole card is dealt face down
    const hole = next.entities[next.zones.dealer.items[1]!]!;
    expect(hole.faceUp).toBe(false);
    expect(events.filter((e) => e.type === "moved")).toHaveLength(4);
    // #endregion unit
  });

  test("a scripted game", () => {
    // #region simulate
    const first = init(ticTacToe, { players: ["p1", "p2"], seed: "script" });
    const x = first.prompts[0]!.actors[0]!;
    const o = x === "p1" ? "p2" : "p1";
    const place = (player: string, index: number, prompt: string): Input => ({
      prompt,
      player,
      action: "placeMark",
      args: { index },
    });
    // Prompt ids count up from q1, one per prompt opened
    const results = simulate(ticTacToe, {
      players: ["p1", "p2"],
      seed: "script",
      inputs: [
        place(x, 0, "q1"),
        place(o, 3, "q2"),
        place(x, 1, "q3"),
        place(o, 4, "q4"),
        place(x, 2, "q5"),
      ],
    });
    const last = results.at(-1)!;
    expect(last.state.vars.winner).toBe(x);
    expectPrompt(last, { node: "again", kind: "pause" });
    // #endregion simulate
  });

  test("a golden replay", () => {
    // #region golden
    // Record a game, choosing each input with a seeded random pick
    const random = seededRandom("golden-picks");
    const { golden } = record(
      blackjack,
      { players: ["p1"], seed: "golden", maxInputs: 60 },
      (result) => {
        const prompt = result.prompts[0];
        if (!prompt) return undefined;
        return random.pick(
          legalInputs(blackjack, result.state, prompt.actors[0]!),
        );
      },
    );
    // golden: { players, seed, inputs, finalStateHash }. Save it as JSON.

    // In a test: replaying the inputs must reach the same state
    expect(hashState(replay(blackjack, golden))).toBe(golden.finalStateHash);
    // #endregion golden
    expect(golden.inputs.length).toBeGreaterThan(10);
  });

  test("invariants", () => {
    const { state } = init(blackjack, { players: ["p1"], seed: "inv" });
    // #region invariants
    expect(checkInvariants(state)).toEqual([]);
    // #endregion invariants
  });
});

describe("saving and undo", () => {
  test("undo by replaying all but the last input", () => {
    const opts = { players: ["p1", "p2"], seed: "undo" };
    const start = init(ticTacToe, opts);
    const inputs: Input[] = [];
    let current: ApplyResult<TicTacToeTypes> = start;
    for (const index of [0, 4]) {
      const p = current.prompts[0]!;
      const input: Input = {
        prompt: p.id,
        player: p.actors[0]!,
        action: "placeMark",
        args: { index },
      };
      const res = apply(ticTacToe, current.state, input);
      if (!res.ok) throw new Error(res.error.message);
      inputs.push(input);
      current = res;
    }
    // #region undo
    // Undo: replay every input but the last
    const undone = replay(ticTacToe, { ...opts, inputs: inputs.slice(0, -1) });
    // #endregion undo
    expect(undone.vars.marks.filter(Boolean)).toHaveLength(1);
    expect(hashState(undone)).not.toBe(hashState(current.state));
  });
});

describe("server", () => {
  test("each client gets only its own view", () => {
    // #region room
    const room = new GameRoom(ticTacToe, ["alice", "bob"], "room-1");
    const sent: { to: string; message: unknown }[] = [];
    room.onSend = (to, message) => sent.push({ to, message });

    // A client sends an input; the room checks it and broadcasts
    const { prompts } = room.viewFor("alice");
    const first = prompts.find((p) => p.actors.length)!;
    const error = room.receive(first.actors[0]!, {
      prompt: first.id,
      player: first.actors[0]!,
      action: "placeMark",
      args: { index: 4 },
    });
    // error is undefined; both players were sent their own view and events
    // #endregion room
    expect(error).toBeUndefined();
    expect(sent.map((s) => s.to).sort()).toEqual(["alice", "bob"]);
  });

  test("a client can't act for someone else", () => {
    const room = new GameRoom(ticTacToe, ["alice", "bob"], "room-2");
    const p = room.viewFor("alice").prompts[0]!;
    const other = p.actors[0] === "alice" ? "bob" : "alice";
    const error = room.receive(other, {
      prompt: p.id,
      player: p.actors[0]!,
      action: "placeMark",
      args: { index: 0 },
    });
    expect(error).toBe("You can only act for yourself");
  });
});
