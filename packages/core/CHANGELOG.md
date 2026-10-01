# @drock07/board-game-toolkit-core

## 1.0.0

### Minor Changes

- [#41](https://github.com/drock07/board-game-toolkit/pull/41) [`e7e25e6`](https://github.com/drock07/board-game-toolkit/commit/e7e25e6e96ee04daaab394c916e508da6be49f93) Thanks [@drock07](https://github.com/drock07)! - **Breaking:** core now exports everything by name, from the root and from domain subpaths.
  - **The `Cards`, `Dice` and `StateMachine` namespace exports are removed.** Import functions directly:
    - from the root: `import { shuffle, roll, createEngine } from "@drock07/board-game-toolkit-core"`
    - or from a subpath: `/cards`, `/dice` or `/state-machine`

    To keep a namespace, use `import * as Cards from "@drock07/board-game-toolkit-core/cards"`.

  - **The `./stateMachine` subpath is renamed to `./state-machine`.**
  - **`StateMachineEngine#getCurrentStateForMachine` is renamed to `getMachineCurrentState`**, matching the standalone function.

  Also:
  - **The published ESM now loads in Node.** Relative imports in `dist` were missing their `.js` extensions, so the package only worked through a bundler.
  - **Transition signals use a registered symbol** (`Symbol.for("board-game-toolkit.transition")`), so they keep working if two copies of core end up in one bundle.
  - **Package metadata:** the package declares `"sideEffects": false` and `"engines": { "node": ">=22" }`, and no longer sets `"main"`.

- [#42](https://github.com/drock07/board-game-toolkit/pull/42) [`02f86c3`](https://github.com/drock07/board-game-toolkit/commit/02f86c3741901a20030a2443ec1b90a50af86343) Thanks [@drock07](https://github.com/drock07)! - **Breaking:** randomness is now explicit and seeded, and games can be replayed.
  - **Every helper that uses randomness takes a required trailing `rng`:**
    - `shuffle(items, rng)` and `shufflePool(state, pool, rng)`
    - `roll(die, rng)` and `roll(die, amount, rng)`, plus `sum`, `withAdvantage`, `withDisadvantage`, `keepHighest` and `keepLowest`
    - `draw` and `drawFromPool` when they reshuffle
    - `addToPool`, `moveCard`, `drawToPool`, `dealFromPool` and `splitPool` with position `"random"`

    Calls that don't involve randomness are unchanged.

  - **New `random` module**, also available as the `/random` subpath:
    - `createRng(seed)`, a seeded mulberry32 generator with serializable state
    - `unseededRng`, for places where reproducibility doesn't matter
    - `randomSeed()`
  - **The engine owns a seeded `rng`:**
    - `createEngine(initialState, { seed })` records the seed (a random one if omitted) and passes `rng` to `onEnter`, `onExit`, `execute` and `getNext`.
    - `getNext` now receives a context argument.
    - `EffectContext` requires an `rng` for the built-in effects.
  - **`EngineState.history` is replaced by `log`**, which records every operation with the `emit` responses it received. The new `replay(config, initialState, { seed, log })` rebuilds a game exactly. `StateMachineEngine#history` is replaced by `log` and `seed`.

### Patch Changes

- [#34](https://github.com/drock07/board-game-toolkit/pull/34) [`41bcdc7`](https://github.com/drock07/board-game-toolkit/commit/41bcdc712d4a8fa5a52dccdc26d4deff7a43700e) Thanks [@drock07](https://github.com/drock07)! - Stop publishing compiled test files in `dist`. Test files now go through a separate build tsconfig, so the published package no longer includes `*.test.js` files that import `vitest`.

## 0.5.0

### Minor Changes

- [`2b1b359`](https://github.com/drock07/board-game-toolkit/commit/2b1b359b2a831a51ac7c7a272e665d6905ecb884) Thanks [@drock07](https://github.com/drock07)! - Add async emit system for state machine event coordination

  The state machine engine now supports an `emit` function in lifecycle hooks (`onEnter`, `onExit`) and action `execute` handlers. When called, `emit` pauses execution until the UI responds, enabling three key patterns:
  - **Animation sync**: Game logic emits an event, the UI animates, then calls `respond()` to continue
  - **Player prompts**: Game logic emits a prompt (e.g. "choose a color"), the UI collects input, responds with the value
  - **Acknowledgment**: Emit a pause point for the UI to show a "continue" button or auto-advance

  Events are typed via an interface map with function signatures, providing full type safety for event data and response values.

  **New in core:**
  - `EmitFn`, `LifecycleContext`, `ActionContext` types
  - `TEvents` generic parameter on `StateMachineConfig` and related types
  - Engine functions (`start`, `advance`, `dispatch`) are now async and accept an optional `EmitHandler`
  - `transitioning` guard prevents dispatch during async transitions

  **New in react:**
  - `useGameEvent` hook with two forms:
    - Callback form: `useGameEvent<TEvents>("eventName", handler)` — registers a handler
    - Declarative form: `useGameEvent<TEvents>("eventName")` — returns `{ isEventActive, eventData, eventId, respond }`
  - `transitioning` state exposed via context

  **Breaking:** The 3rd parameter of `ActionHandler.execute` changed from `transitionTo` to `{ transitionTo, emit }`. Update existing handlers to destructure: `(state, cmd, { transitionTo })`.

## 0.4.0

### Minor Changes

- [`f10128f`](https://github.com/drock07/board-game-toolkit/commit/f10128f8bd8e4a367a60e129a55a7ffb51592cb3) Thanks [@drock07](https://github.com/drock07)! - Add card effect system for declarative card effects with reducer-style resolution
  - Add `CardEffect` base interface and `EffectCard<TEffect>` for cards that carry effects
  - Add `EffectContext<TCard>` for passing context (triggering card) to effect handlers
  - Add `EffectHandler`, `EffectHandlerMap` types for mapping effect types to handler functions
  - Add `resolveEffects()` for left-to-right fold of effects over game state
  - Add built-in `TransferCardsEffect` (with `count: number | "all"` and `toPosition`) and `ShufflePoolEffect`
  - Add `createBuiltinEffectHandlers()` factory for pool-based effect handlers that can be spread into custom handler maps

## 0.3.0

### Minor Changes

- [`5200186`](https://github.com/drock07/board-game-toolkit/commit/5200186085fe88637154072dc59ef3e27cbe03ed) Thanks [@drock07](https://github.com/drock07)! - Add generic card game pool utilities and fix CardHand key/focus bugs

  **Core:**
  - Add `GenericCardInstance` and `GenericCardGameState` interfaces for building custom card games
  - Add 13 pool manipulation functions: `addToPool`, `removeFromPool`, `drawFromPool`, `shufflePool`, `moveCard`, `drawToPool`, `findInPool`, `dealFromPool`, `peekPool`, `sortPool`, `countInPool`, `splitPool`, `swapCards`
  - Add `PoolIdOf` and `CardOf` helper types for deriving types from state
  - All functions preserve extended state types via `TState extends GenericCardGameState` generics
  - Add JSDoc to `draw`, `shuffle`, and all `playing-cards` exports

  **React:**
  - Fix `getItemKey` stripping React's `.$` key prefix from `Children.toArray`
  - Fix first card appearing selected on mount by deferring focus index until interaction
  - Sync `focusedIndex` with clicked card to prevent stale focus indicator

## 0.2.3

### Patch Changes

- [`506d071`](https://github.com/drock07/board-game-toolkit/commit/506d071639ae6e948e54e501b5678a1ff4012bb0) Thanks [@drock07](https://github.com/drock07)! - Fix `draw` returning an empty `reshuffleDeck` even when no reshuffle occurred

## 0.2.2

### Patch Changes

- [`a7ac103`](https://github.com/drock07/board-game-toolkit/commit/a7ac103c0d997ec39df260163967db0284e0ffbf) Thanks [@drock07](https://github.com/drock07)! - Fix `draw` returning a single item instead of an array when called with `count: 1`

## 0.2.1

### Patch Changes

- [`ddad6f7`](https://github.com/drock07/board-game-toolkit/commit/ddad6f72129b02a9487af389e4db25825ffb04e4) Thanks [@drock07](https://github.com/drock07)! - ### Core: Relax `onEnter` data parameter type

  Changed the `data` parameter in `onEnter` from `unknown` to `any`, allowing inline typing of the parameter without needing a cast (e.g., `onEnter: (state, data?: { round: number }) => ...`).

  ### React: Support unselecting cards in CardHand

  `CardHand` now toggles selection — clicking or activating an already-selected card calls `onCardClick` with `null`. The `onCardClick` type is updated from `(key: string) => void` to `(key: string | null) => void`.

## 0.2.0

### Minor Changes

- [`5526e9d`](https://github.com/drock07/board-game-toolkit/commit/5526e9d41bc6ad548f1307916c29d7ae1a3288ba) Thanks [@drock07](https://github.com/drock07)! - ### Action-triggered state transitions

  Actions can now trigger state transitions directly from `execute` using a `transitionTo` helper passed as the third argument. This decouples "this action needs a resolution state" from "I'm done with this state" (`advance()`).

  ```ts
  execute: (state, cmd, transitionTo) => {
    const newState = { ...state, pending: true };
    return transitionTo("resolveOverflow", newState);
  };
  ```

  ### Transition data

  Both `getNext` and `transitionTo` can now pass data to the target state's `onEnter`:

  ```ts
  // From getNext — use a tuple
  getNext: (state) => ["gameOver", { result: state.winner }];

  // From action-triggered transitions — optional third arg
  transitionTo("resolveOverflow", newState, { returnTo: "playCards" });

  // Received in onEnter as the second argument
  onEnter: (state, data) => {
    const { result } = data as { result: string };
    return { ...state, gameResult: result };
  };
  ```

  ### Breaking: `onExit` now runs after `getNext`

  Previously, `onExit` ran before `getNext` during `advance()`. Now `getNext` runs first (routing decision), then `onExit` (cleanup). This means `getNext` sees the pre-exit state, which is more intuitive for routing decisions that depend on state values modified by `onExit`.

  The engine internals have been simplified to two core functions (`enterState` and `resolveNext`) that handle all state transitions, replacing the previous `transitionTo`/`startMachine`/`completeMachine` decomposition.

  ### `draw` supports reshuffling from a discard pile

  `draw` now accepts an optional `reshuffleFrom` array. When the draw deck doesn't have enough cards, it shuffles the reshuffle pile into the draw deck before drawing.

  ```ts
  // Single draw with reshuffle
  const [card, newDeck, newDiscard] = draw(deck, discardPile);

  // Multi-draw with reshuffle
  const [cards, newDeck, newDiscard] = draw(deck, 5, discardPile);
  ```

  When reshuffling occurs, the returned discard pile is empty (all cards moved back into the draw deck).

  ### Breaking: `getCurrentState` returns root-to-leaf order

  `getCurrentState` now returns the state path from the outermost machine to the innermost leaf, matching the natural hierarchy. Previously the array was reversed (leaf-first). This makes the `State` component's array matching read as a path: `state={["game", "round", "draw"]}`.

  ### `CardHand` component

  New `CardHand` (controlled) and `UncontrolledCardHand` components for displaying a hand of overlapping cards. Features:
  - Key-based selection with hover/focus raise effect
  - Keyboard navigation (arrow keys, Home/End, Enter/Space) and ARIA listbox semantics
  - Optional `arc` prop for fan/arc layout
  - Animated position transitions when cards are added/removed
  - `getCardProps` callback for drag-and-drop integration (e.g. dnd-kit)

## 0.1.0

### Minor Changes

- fdd72b6: Initial release
