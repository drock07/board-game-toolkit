import { describe, expect, it } from "vitest";
import { shuffle } from "../cards/deck.js";
import { D6, roll } from "../dice/index.js";
import type { EmitHandler, StateMachineConfig } from "./StateMachineConfig.js";
import {
  advance,
  createEngine,
  dispatch,
  replay,
  start,
  type EngineState,
} from "./StateMachineEngine.js";

interface GameState {
  deck: number[];
  hand: number[];
  rolls: number[];
  answers: string[];
  path: string[];
}

type GameCommand =
  | { type: "draw" }
  | { type: "roll" }
  | { type: "ask" }
  | { type: "fail" };

const initialState: GameState = {
  deck: [1, 2, 3, 4, 5, 6, 7, 8],
  hand: [],
  rolls: [],
  answers: [],
  path: [],
};

/** Uses randomness in onEnter, execute and getNext, and asks via emit. */
const config: StateMachineConfig<GameState, GameCommand> = {
  id: "game",
  initial: "turn",
  onEnter: (state, _data, { rng }) => ({
    ...state,
    deck: shuffle(state.deck, rng),
  }),
  states: {
    turn: {
      actions: {
        draw: {
          execute: (state) => ({
            ...state,
            hand: [...state.hand, state.deck[0]],
            deck: state.deck.slice(1),
          }),
        },
        roll: {
          execute: (state, _cmd, { rng }) => ({
            ...state,
            rolls: [...state.rolls, roll(D6, rng)],
          }),
        },
        ask: {
          execute: async (state, _cmd, { emit }) => {
            const answer = (await emit({ type: "ask" })) as string;
            return { ...state, answers: [...state.answers, answer] };
          },
        },
        fail: { validate: () => false, execute: (state) => state },
      },
      getNext: (_state, { rng }) => (rng.int(2) === 0 ? "left" : "right"),
    },
    left: {
      autoadvance: true,
      onEnter: (state, _data, { rng }) => ({
        ...state,
        path: [...state.path, "left"],
        rolls: [...state.rolls, roll(D6, rng)],
      }),
      getNext: () => "turn",
    },
    right: {
      autoadvance: true,
      onEnter: (state) => ({ ...state, path: [...state.path, "right"] }),
      getNext: () => "turn",
    },
  },
};

/** Answers each emit with a different value, like a player would. */
function makePlayer(): EmitHandler {
  let n = 0;
  return () => Promise.resolve(`answer-${n++}`);
}

async function playGame(seed?: number) {
  const player = makePlayer();
  let engine: EngineState<GameState, GameCommand> = createEngine(
    initialState,
    seed === undefined ? {} : { seed },
  );
  engine = await start(engine, config, player);
  for (let i = 0; i < 5; i++) {
    engine = await dispatch(engine, { type: "draw" }, player);
    engine = await dispatch(engine, { type: "roll" }, player);
    engine = await dispatch(engine, { type: "ask" }, player);
    engine = await advance(engine, player);
  }
  return engine;
}

describe("seeded engine", () => {
  it("plays the same game for the same seed", async () => {
    const a = await playGame(123);
    const b = await playGame(123);
    expect(a.state).toEqual(b.state);
  });

  it("plays a different game for a different seed", async () => {
    const a = await playGame(1);
    const b = await playGame(2);
    expect(a.state).not.toEqual(b.state);
  });

  it("records a random seed when none is given", async () => {
    const engine = await playGame();
    expect(Number.isInteger(engine.seed)).toBe(true);
    const replayed = await replay(config, initialState, engine);
    expect(replayed.state).toEqual(engine.state);
  });

  it("logs each operation with its emit responses", async () => {
    const engine = await playGame(5);
    expect(engine.log[0]).toEqual({ op: "start", responses: [] });
    expect(engine.log[3]).toEqual({
      op: "dispatch",
      command: { type: "ask" },
      responses: ["answer-0"],
    });
    expect(engine.log).toHaveLength(1 + 5 * 4);
  });

  it("doesn't log or consume randomness for a failed operation", async () => {
    const before = await playGame(9);
    // Explicit generics: dispatch infers TCommand from the command, not the engine (#28)
    await expect(
      dispatch<GameState, GameCommand>(before, { type: "fail" }),
    ).rejects.toThrow();
    // The engine is immutable; a successful roll afterwards uses the same
    // random state the failed command saw
    const afterRoll = await dispatch<GameState, GameCommand>(before, {
      type: "roll",
    });
    expect(afterRoll.log).toHaveLength(before.log.length + 1);
    expect(afterRoll.rngState).not.toBe(before.rngState);
  });
});

describe("replay", () => {
  it("reproduces the final state exactly from the seed and log", async () => {
    const original = await playGame(2026);

    const replayed = await replay(config, initialState, {
      seed: original.seed,
      log: original.log,
    });

    expect(replayed.state).toEqual(original.state);
    expect(replayed.rngState).toBe(original.rngState);
    expect(replayed.log).toEqual(original.log);
    expect(replayed.machineStack.map((m) => m.currentState)).toEqual(
      original.machineStack.map((m) => m.currentState),
    );
  });

  it("fails loudly when the log doesn't match the config", async () => {
    const original = await playGame(77);
    const tampered = original.log.map((entry) =>
      entry.op === "dispatch" && entry.command.type === "ask"
        ? { ...entry, responses: [] }
        : entry,
    );
    await expect(
      replay(config, initialState, { seed: original.seed, log: tampered }),
    ).rejects.toThrow(/Replay diverged/);
  });
});
