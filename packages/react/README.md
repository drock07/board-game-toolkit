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

Returns the current state names as an array, ordered root-to-leaf (outermost machine to innermost state). Optionally pass a machine ID to get a specific machine's current state.

```tsx
// All active states (root-to-leaf)
const currentState = useStateMachineCurrentState();
// ["game", "round", "draw"]

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

### Action-Triggered Transitions

An `execute` handler can trigger a state transition by using the `transitionTo` helper passed as the third argument. This is useful when a command needs to move the machine to a different state (e.g., entering a resolution phase):

```tsx
actions: {
  playCard: {
    execute: (state, cmd, transitionTo) => {
      const newState = { ...state, pending: true };
      return transitionTo("resolveEffect", newState);
    },
  },
},
```

`transitionTo` accepts an optional third argument for transition data, which is passed to the target state's `onEnter`:

```tsx
return transitionTo("resolveEffect", newState, { returnTo: "playCards" });
```

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

**Hierarchy match with wildcards** - matches against the state path (root-to-leaf):

```tsx
{/* "round" machine with any leaf state */}
<State state={["round", "*"]}>
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

### `CardHand`

Displays a hand of overlapping cards with hover/focus raise, selection, and optional fan layout. Comes in controlled and uncontrolled variants.

```tsx
import { CardHand, UncontrolledCardHand } from "@drock07/board-game-toolkit-react";

// Uncontrolled — manages selection internally
<UncontrolledCardHand onSelect={(key) => console.log(key)}>
  <MyCard key="ace" />
  <MyCard key="king" />
  <MyCard key="queen" />
</UncontrolledCardHand>

// Controlled — parent owns selection state
<CardHand selectedKey={selectedKey} onCardClick={setSelectedKey}>
  {cards.map((card) => <MyCard key={card.id} card={card} />)}
</CardHand>
```

| Prop | Type | Description |
| --- | --- | --- |
| `children` | `ReactNode` | Card elements to display |
| `selectedKey` | `string \| null` | Currently selected card key (controlled) |
| `onCardClick` | `(key: string) => void` | Called when a card is clicked (controlled) |
| `onSelect` | `(key: string \| null) => void` | Called when selection changes (uncontrolled) |
| `arc` | `number` | Fan intensity (0 = flat, 1 = full arc). Default `0` |
| `getCardProps` | `(key: string) => CardWrapperProps` | Prop getter for drag-and-drop integration |
| `cardWidth` | `number` | Card width override (falls back to `CardDimensionsContext`) |
| `cardAspectRatio` | `number` | Card aspect ratio override |
| `className` | `string` | Container class (replaces default `"w-full"`) |
| `style` | `CSSProperties` | Container style |
| `aria-label` | `string` | Accessible label. Default `"Card hand"` |

**Keyboard navigation:** Arrow keys to move focus, Home/End to jump, Enter/Space to select. The component uses `role="listbox"` with `role="option"` on each card.

**Drag-and-drop:** Use `getCardProps` to attach refs, event handlers, and transforms from libraries like dnd-kit. The component composes the consumer's `transform` and `transition` with its own layout transforms.

### StateModule Types

| Type | Description |
| --- | --- |
| `StateLeafModule` | `{ component: React.FC }` - a leaf state with a component |
| `StateMachineModule<TState>` | A machine state with config, optional layout, and child modules |
| `StateModule<TState>` | Union of `StateLeafModule \| StateMachineModule<TState>` |
