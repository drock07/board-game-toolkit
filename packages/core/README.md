# @drock07/board-game-toolkit-core

Framework-agnostic state machine engine for modeling board game flow. Supports nested machines, lifecycle hooks, actions, and auto-advancing states.

## Installation

```bash
pnpm add @drock07/board-game-toolkit-core
```

Everything is exported by name from the package root. Each domain also has its own entry point, with the same names: `/cards`, `/dice` and `/state-machine`.

```ts
import { shuffle, roll, D6 } from "@drock07/board-game-toolkit-core";
import { shuffle } from "@drock07/board-game-toolkit-core/cards";
```

## Concepts

### State Machine Config

A state machine is defined as a config object with an `id`, an `initial` state, and a map of `states`. Each state can define lifecycle hooks and transition logic.

```ts
import { StateMachineConfig } from "@drock07/board-game-toolkit-core";

interface GameState {
  score: number;
  round: number;
}

const gameConfig: StateMachineConfig<GameState> = {
  id: "game",
  initial: "setup",
  states: {
    setup: {
      onEnter: (state) => ({ ...state, score: 0, round: 1 }),
      getNext: () => "playing",
      autoadvance: true,
    },
    playing: {
      getNext: (state) => (state.round >= 3 ? "gameOver" : "playing"),
    },
    gameOver: {
      // No getNext — this is a terminal state
    },
  },
};
```

### State Lifecycle

Each state supports:

- **`onEnter(state)`** - Called when entering the state. Returns the new state.
- **`getNext(state)`** - Determines the next state name. Return `null` or omit to signal machine completion. Runs before `onExit` so routing decisions see the pre-exit state.
- **`onExit(state)`** - Called when leaving the state (after `getNext`). Returns the new state.
- **`autoadvance`** - When `true` (or a predicate returning `true`), automatically advances after entering.

Both `getNext` and `onEnter` support **transition data** — extra context passed to the target state:

```ts
// From getNext — return a tuple [targetState, data]
getNext: (state) => ["gameOver", { result: state.winner }];

// Received in onEnter as the second argument
onEnter: (state, data) => {
  const { result } = data as { result: string };
  return { ...state, gameResult: result };
};
```

Machines also support `onEnter` and `onExit` for setup/teardown when the machine starts or completes.

### Nested Machines

Any state can be replaced with a full `StateMachineConfig`, enabling hierarchical state machines. The engine manages a stack of active machines.

```ts
const roundConfig: StateMachineConfig<GameState> = {
  id: "round",
  initial: "draw",
  states: {
    draw: { getNext: () => "play" },
    play: { getNext: () => "score" },
    score: { getNext: () => null }, // completes the round machine
  },
};

const gameConfig: StateMachineConfig<GameState> = {
  id: "game",
  initial: "round",
  states: {
    round: roundConfig, // nested machine
    gameOver: {},
  },
};
```

### Actions

Actions are typed functions that modify game state without affecting the machine flow. Define them as standalone functions:

```ts
import { ActionFn } from "@drock07/board-game-toolkit-core";

const addScore: ActionFn<GameState, [points: number]> = (state, points) => ({
  ...state,
  score: state.score + points,
});
```

### Deck Utilities

Generic collection utilities for any "draw from a pile" mechanic — playing cards, event decks, tile bags, etc.

```ts
import { draw, shuffle } from "@drock07/board-game-toolkit-core";

// Shuffle an array (Fisher-Yates). Randomness always comes from an `rng`;
// see "Randomness and replay" below.
const deck = shuffle(cards, rng);

// Draw a single item
const [card, remaining] = draw(deck);

// Draw multiple items
const [hand, remaining] = draw(deck, 5);
```

When a discard pile is available, pass it as the `reshuffleFrom` argument. If the draw deck doesn't have enough cards, the discard pile is shuffled back in before drawing:

```ts
// Single draw with reshuffle
const [card, newDeck, newDiscard] = draw(deck, discardPile, rng);

// Multi-draw with reshuffle
const [cards, newDeck, newDiscard] = draw(deck, 5, discardPile, rng);
```

When reshuffling occurs, the returned discard pile is empty (all cards moved back into the draw deck).

### Randomness and replay

Nothing in the toolkit calls `Math.random()` directly. Every helper that needs randomness takes an `Rng` as a required argument: `shuffle`, `roll` and the other dice helpers, `shufflePool`, reshuffling draws, and pool helpers with the `"random"` position.

Inside the state machine, use the `rng` from the hook context. It's available in `onEnter`, `onExit`, `execute` and `getNext`:

```ts
execute: (state, cmd, { rng }) => ({
  ...state,
  deck: shuffle(state.deck, rng),
  damage: roll(D6, 2, rng),
}),
```

The engine owns that generator. `createEngine(initialState, { seed })` records the seed (a random one if you don't pass it), and every operation is recorded in `engine.log` along with any `emit` responses it received. Together they reproduce the game exactly:

```ts
const rebuilt = await replay(config, initialState, {
  seed: engine.seed,
  log: engine.log,
});
// rebuilt.state deep-equals engine.state
```

Outside the engine, use `createRng(seed)` for reproducible results, or `unseededRng` where reproducibility doesn't matter (for example visual effects).

## Usage

### Functional API

The functional API is fully immutable — every operation returns a new `EngineState` object.

```ts
import {
  createEngine,
  start,
  advance,
  doAction,
} from "@drock07/board-game-toolkit-core";

let engine = createEngine<GameState>({ score: 0, round: 1 });
engine = start(engine, gameConfig);

// Access current state
engine.state; // { score: 0, round: 1 }
engine.machineStack; // active machine stack

// Apply an action
engine = doAction(engine, addScore, 10);

// Advance to the next state
engine = advance(engine);
```

### Class API

The `StateMachineEngine` class wraps the functional API with mutable internal state, if you prefer an imperative style.

```ts
import { StateMachineEngine } from "@drock07/board-game-toolkit-core";

const engine = new StateMachineEngine(gameConfig, { score: 0, round: 1 });
engine.start();

engine.state; // { score: 0, round: 1 }
engine.currentState; // ["setup"] (root-to-leaf)

engine.doAction(addScore, 10);
engine.advance();
```

### Inspecting Current State

`getCurrentState` returns the active state names ordered from root to leaf (outermost machine to innermost state):

```ts
import { getCurrentState } from "@drock07/board-game-toolkit-core";

// If the "round" machine is active and in "draw" state:
getCurrentState(engine); // ["round", "draw"]
```

You can also look up a specific machine's current state by ID:

```ts
import { getMachineCurrentState } from "@drock07/board-game-toolkit-core";

getMachineCurrentState(engine, "round"); // "draw"
getMachineCurrentState(engine, "game"); // "round"
```

## API Reference

### Functions

| Function                                      | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| `createEngine(initialState, { seed })`        | Create an unstarted engine with the given state   |
| `replay(config, initialState, { seed, log })` | Rebuild a game from its seed and log              |
| `start(engine, config)`                       | Start the root machine                            |
| `advance(engine)`                             | Exit the current state and transition to the next |
| `doAction(engine, action, ...args)`           | Apply an action to the game state                 |
| `getCurrentState(engine)`                     | Get active state names (root-to-leaf)             |
| `getMachineCurrentState(engine, machineId)`   | Get a specific machine's current state name       |

### Types

| Type                          | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `StateMachineConfig<TState>`  | Machine config with `id`, `initial`, and `states`              |
| `StateConfig<TState>`         | Config for a single state (lifecycle hooks + transitions)      |
| `EngineState<TState>`         | Immutable engine snapshot (`machineStack`, `state`, `started`) |
| `ActionFn<TState, TArgs>`     | `(state, ...args) => TState`                                   |
| `MachineRuntimeState<TState>` | Runtime state of a single machine in the stack                 |
