# @drock07/board-game-toolkit-react

React bindings for `@drock07/board-game-toolkit-core`. Provides a context provider, hooks, and components for integrating the state machine engine into React applications.

## Installation

```bash
pnpm add @drock07/board-game-toolkit-react @drock07/board-game-toolkit-core
```

Requires React 19 or higher.

## Quick Start

```tsx
import {
  StateMachineContext,
  useStateMachineActions,
  useStateMachineState,
  State,
} from "@drock07/board-game-toolkit-react";

function App() {
  return (
    <StateMachineContext config={gameConfig} initialState={{ score: 0, round: 1 }}>
      <Game />
    </StateMachineContext>
  );
}

function Game() {
  const { start } = useStateMachineActions<GameState, GameCommand>();

  return (
    <>
      <State state="setup">
        <button onClick={start}>Start Game</button>
      </State>
      <State state="playing">
        <PlayingScreen />
      </State>
      <State state="gameOver">
        <GameOverScreen />
      </State>
    </>
  );
}
```

## Provider

### `StateMachineContext`

Wraps your app and manages the engine state internally. Pass your machine config and initial game state as props.

```tsx
<StateMachineContext config={gameConfig} initialState={{ score: 0, round: 1 }}>
  {children}
</StateMachineContext>
```

| Prop | Type | Description |
| --- | --- | --- |
| `config` | `StateMachineConfig<TState, TCommand>` | The state machine configuration |
| `initialState` | `TState` | The initial game state |
| `children` | `ReactNode` | Child components |

## Hooks

### `useStateMachineState<TState>()`

Returns the current game state.

```tsx
const gameState = useStateMachineState<GameState>();
// gameState.score, gameState.round, etc.
```

### `useStateMachineActions<TState, TCommand>()`

Returns the engine action functions: `start`, `advance`, `dispatch`, and `canDispatch`.

```tsx
const { start, advance, dispatch, canDispatch } = useStateMachineActions<GameState, GameCommand>();

// Start the machine
start();

// Advance to the next state
advance();

// Dispatch a command
dispatch({ type: "addScore", points: 10 });

// Check if a command can be dispatched
if (canDispatch({ type: "addScore", points: 10 })) {
  // command is valid in the current state
}
```

### `useStateMachineCurrentState()`

Returns the current state names as an array, ordered leaf-first. Optionally pass a machine ID to get a specific machine's current state.

```tsx
// All active states (leaf-first)
const currentState = useStateMachineCurrentState();
// ["draw", "round", "game"]

// Specific machine's state
const roundState = useStateMachineCurrentState("round");
// "draw"
```

### `useStateMachineEngineState<TState>()`

Returns engine-level metadata: whether the machine has started and the current state hierarchy.

```tsx
const { started, currentState } = useStateMachineEngineState<GameState>();
```

## Commands

Actions are defined as command objects with a `type` discriminant. Define a command union for your game, then declare handlers in the state machine config:

```tsx
// Define your command types
type GameCommand =
  | { type: "addScore"; points: number }
  | { type: "drawCard" };

// Define your config with command handlers
const gameConfig: StateMachineConfig<GameState, GameCommand> = {
  id: "game",
  initial: "playing",
  states: {
    playing: {
      actions: {
        addScore: {
          validate: (state, cmd) => cmd.points > 0,
          execute: (state, cmd) => ({
            ...state,
            score: state.score + cmd.points,
          }),
        },
        drawCard: {
          execute: (state) => ({
            ...state,
            hand: [...state.hand, state.deck[0]],
            deck: state.deck.slice(1),
          }),
        },
      },
      getNext: () => null,
    },
  },
};
```

Each handler receives the narrowed command type — `addScore`'s handler gets `{ type: "addScore"; points: number }`, not the full union. The `validate` function is optional and controls whether the command is allowed in the current state.

All dispatched commands are recorded in `engine.history` for debugging, replay, or undo.

## Components

### `State`

Conditionally renders children based on the current state. Supports three matching modes:

**Exact match** - matches the leaf state:

```tsx
<State state="playing">
  <PlayingScreen />
</State>
```

**Hierarchy match with wildcards** - matches against the state stack (leaf-first):

```tsx
{/* Any leaf state where the parent is "round" */}
<State state={["*", "round"]}>
  <RoundLayout />
</State>
```

**Includes match** - matches if the state appears anywhere in the stack:

```tsx
<State includes="round">
  <RoundHUD />
</State>
```

### `StateTree`

Automatically renders the correct component tree based on the current machine state. Uses `StateModule` definitions to map states to components and supports nested machines with optional layouts.

```tsx
import { StateTree, StateMachineModule, StateLeafModule } from "@drock07/board-game-toolkit-react";

const drawModule: StateLeafModule = {
  component: DrawScreen,
};

const roundModule: StateMachineModule<GameState> = {
  stateMachineConfig: roundConfig,
  layout: RoundLayout,
  childModules: {
    draw: drawModule,
    play: { component: PlayScreen },
    score: { component: ScoreScreen },
  },
};

const gameModule: StateMachineModule<GameState> = {
  stateMachineConfig: gameConfig,
  childModules: {
    round: roundModule,
    gameOver: { component: GameOverScreen },
  },
};

function App() {
  return (
    <StateMachineContext config={gameConfig} initialState={initialState}>
      <StateTree module={gameModule} />
    </StateMachineContext>
  );
}
```

### StateModule Types

| Type | Description |
| --- | --- |
| `StateLeafModule` | `{ component: React.FC }` - a leaf state with a component |
| `StateMachineModule<TState>` | A machine state with config, optional layout, and child modules |
| `StateModule<TState>` | Union of `StateLeafModule \| StateMachineModule<TState>` |
