// The saving and replays guide's samples, run against High Card.
import {
  apply,
  init,
  load,
  randomBot,
  replayInputs,
  save,
  SaveError,
  specHash,
  type GameEvent,
  type GameInput,
  type State,
} from "@drock07/board-game-toolkit-engine";
import { playBots } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { sealedBids } from "../games/sealed-bids/game";
import { highCard, type Vars } from "./highCard";

const players = ["ann", "bob"];

/** A finished game of High Card, played by bots: its states and inputs. */
function played() {
  const { states, inputs } = playBots(highCard, {
    players,
    seed: "demo",
    bots: randomBot("demo"),
    maxInputs: 100,
  });
  return { states, inputs: inputs as GameInput<typeof highCard>[] };
}

test("a save loads into the same game, and only into it", () => {
  const { states } = played();
  const state = states[3]!;
  // #region save
  const text = save(highCard, state); // JSON, stamped with the spec hash
  const loaded = load(highCard, text); // the same state

  specHash(highCard); // "…": a hash of the zones, flow, abilities and effects

  try {
    load(sealedBids, text);
  } catch (e) {
    if (e instanceof SaveError) e.message;
    // "This save is from a different version of the game (its spec hash doesn't match)"
  }
  // #endregion save
  expect(loaded).toEqual(state);
  expect(JSON.parse(text)).toMatchObject({
    format: "board-game-toolkit/save",
    body: { spec: specHash(highCard) },
  });
  expect(() => load(sealedBids, text)).toThrow(SaveError);
  expect(() => load(sealedBids, text)).toThrow(/spec hash doesn't match/);
  expect(() => load(highCard, "not json")).toThrow(SaveError);
});

test("a log of inputs replays, and a bad one says which input failed", () => {
  const { states, inputs } = played();
  // #region log
  // A game's log: who played, the seed, and every accepted input
  const log = { players, seed: "demo", inputs };
  const state = replayInputs(highCard, log, log.inputs);

  // An input that no longer applies throws a SaveError naming it
  const broken = [inputs[1]!, ...inputs];
  try {
    replayInputs(highCard, log, broken);
  } catch (e) {
    if (e instanceof SaveError) e.message;
    // "Input 0 (playCard by bob) was rejected: It is ann's turn, not bob's"
  }
  // #endregion log
  expect(state).toEqual(states.at(-1));
  expect(() => replayInputs(highCard, log, broken)).toThrow(
    "Input 0 (playCard by bob) was rejected: It is ann's turn, not bob's",
  );
});

test("undo: pop a stack of states, or replay all but the last input", () => {
  const { states, inputs } = played();
  // #region undo
  // Keep every state: undo is popping the stack
  const history: State<Vars>[] = [init(highCard, { players, seed: "demo" })];
  for (const input of inputs.slice(0, 4)) {
    const out = apply(highCard, history.at(-1)!, input);
    if (out.ok) history.push(out.state);
  }
  history.pop(); // back to before the fourth input

  // Or keep only the inputs: replay all but the last
  const undone = replayInputs(
    highCard,
    { players, seed: "demo" },
    inputs.slice(0, 3),
  );
  // #endregion undo
  expect(history.at(-1)).toEqual(states[3]);
  expect(undone).toEqual(states[3]);
});

test("a replay viewer steps through a game with each step's events", () => {
  const { states, inputs } = played();
  // #region viewer
  /** Every step of a game: the state after each input, and its events. */
  function steps(log: {
    players: string[];
    seed: string;
    inputs: GameInput<typeof highCard>[];
  }) {
    let state = init(highCard, log);
    const out: { state: State<Vars>; events: GameEvent<Vars>[] }[] = [];
    for (const input of log.inputs) {
      const next = apply(highCard, state, input);
      if (!next.ok) throw new Error(next.reason);
      out.push({ state: next.state, events: next.events });
      state = next.state;
    }
    return out;
  }
  // #endregion viewer
  const all = steps({ players, seed: "demo", inputs });
  expect(all).toHaveLength(inputs.length);
  expect(all.map((s) => s.state)).toEqual(states.slice(1));
  expect(all.every((s) => s.events.length > 0)).toBe(true);
});
