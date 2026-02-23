# @board-game-toolkit/core

Framework-agnostic state machine engine for modeling board game flow. Supports nested machines, lifecycle hooks, actions, and auto-advancing states.

## Installation

```bash
pnpm add @board-game-toolkit/core
```

## Concepts

### State Machine Config

A state machine is defined as a config object with an `id`, an `initial` state, and a map of `states`. Each state can define lifecycle hooks and transition logic.

```ts
import { StateMachineConfig } from "@board-game-toolkit/core";

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
- **`onExit(state)`** - Called when leaving the state. Returns the new state.
- **`getNext(state)`** - Determines the next state name. Return `null` or omit to signal machine completion.
- **`autoadvance`** - When `true` (or a predicate returning `true`), automatically advances after entering.

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
import { ActionFn } from "@board-game-toolkit/core";

const addScore: ActionFn<GameState, [points: number]> = (state, points) => ({
  ...state,
  score: state.score + points,
});
```

## Usage

### Functional API

The functional API is fully immutable — every operation returns a new `EngineState` object.

```ts
import { createEngine, start, advance, doAction } from "@board-game-toolkit/core";

let engine = createEngine<GameState>({ score: 0, round: 1 });
engine = start(engine, gameConfig);

// Access current state
engine.state;          // { score: 0, round: 1 }
engine.machineStack;   // active machine stack

// Apply an action
engine = doAction(engine, addScore, 10);

// Advance to the next state
engine = advance(engine);
```

### Class API

The `StateMachineEngine` class wraps the functional API with mutable internal state, if you prefer an imperative style.

```ts
import { StateMachineEngine } from "@board-game-toolkit/core";

const engine = new StateMachineEngine(gameConfig, { score: 0, round: 1 });
engine.start();

engine.state;          // { score: 0, round: 1 }
engine.currentState;   // ["setup", "game"] (leaf-first)

engine.doAction(addScore, 10);
engine.advance();
```

### Inspecting Current State

`getCurrentState` returns the active state names ordered from most-specific (leaf) to least-specific (root):

```ts
import { getCurrentState } from "@board-game-toolkit/core";

// If the "round" machine is active and in "draw" state:
getCurrentState(engine); // ["draw", "round"]
```

You can also look up a specific machine's current state by ID:

```ts
import { getMachineCurrentState } from "@board-game-toolkit/core";

getMachineCurrentState(engine, "round"); // "draw"
getMachineCurrentState(engine, "game");  // "round"
```

## API Reference

### Functions

| Function | Description |
| --- | --- |
| `createEngine(initialState)` | Create an unstarted engine with the given state |
| `start(engine, config)` | Start the root machine |
| `advance(engine)` | Exit the current state and transition to the next |
| `doAction(engine, action, ...args)` | Apply an action to the game state |
| `getCurrentState(engine)` | Get active state names (leaf-first) |
| `getMachineCurrentState(engine, machineId)` | Get a specific machine's current state name |

### Types

| Type | Description |
| --- | --- |
| `StateMachineConfig<TState>` | Machine config with `id`, `initial`, and `states` |
| `StateConfig<TState>` | Config for a single state (lifecycle hooks + transitions) |
| `EngineState<TState>` | Immutable engine snapshot (`machineStack`, `state`, `started`) |
| `ActionFn<TState, TArgs>` | `(state, ...args) => TState` |
| `MachineRuntimeState<TState>` | Runtime state of a single machine in the stack |
