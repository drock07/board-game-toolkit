# @drock07/board-game-toolkit-react

## 1.0.0

### Minor Changes

- [#37](https://github.com/drock07/board-game-toolkit/pull/37) [`dc8301f`](https://github.com/drock07/board-game-toolkit/commit/dc8301f8965a4ecb6cad55a7816a5ae9d7ef1764) Thanks [@drock07](https://github.com/drock07)! - **Breaking:** `GridGameBoard` now calls its `children` render function with `(x, y)`, where `x` is the column and `y` is the row, as its type always declared and matching `CardGrid`. It previously passed `(row, column)`. If your callback relied on the old order, swap its parameters.

  `GridGameBoard` also merges the caller's `style` into its grid styles instead of overwriting it.

- [#41](https://github.com/drock07/board-game-toolkit/pull/41) [`e7e25e6`](https://github.com/drock07/board-game-toolkit/commit/e7e25e6e96ee04daaab394c916e508da6be49f93) Thanks [@drock07](https://github.com/drock07)! - **Breaking:** packaging and export changes.
  - **`@drock07/board-game-toolkit-core` is now a peer dependency.** Install it alongside this package. Core and react are now versioned together.
  - **`PATTERNS` is renamed to `CARD_BACK_PATTERNS`.**

  Also:
  - **New domain subpaths** alongside the root: `/backgrounds`, `/boards`, `/cards`, `/dice` and `/state-machine`.
  - **`useRollingAnimation` is now exported.**
  - **The published ESM now loads in Node** (its relative imports now include `.js` extensions).
  - **Package metadata:** the package declares `"sideEffects": false` and `"engines": { "node": ">=22" }`, and no longer sets `"main"`.

- [#42](https://github.com/drock07/board-game-toolkit/pull/42) [`02f86c3`](https://github.com/drock07/board-game-toolkit/commit/02f86c3741901a20030a2443ec1b90a50af86343) Thanks [@drock07](https://github.com/drock07)! - - **New `seed` prop** on `StateMachineContext` (and `withStateMachineContext`'s options) to reproduce a game. The component returned by `withStateMachineContext` also accepts a `seed` prop, which overrides the option (e.g. a seed read from the URL). `useStateMachineEngineState` now returns the engine's `seed`.
  - **`CardStack`'s scatter** uses core's seeded generator. The pattern shifts slightly, once.

- [#40](https://github.com/drock07/board-game-toolkit/pull/40) [`aa8bfde`](https://github.com/drock07/board-game-toolkit/commit/aa8bfde7febdf9232887fb408cac674ee2742dd9) Thanks [@drock07](https://github.com/drock07)! - `StateMachineContext` no longer swallows errors.
  - **New `onError` prop** (also on `withStateMachineContext`'s options). It's called with the error and the operation (`"start"`, `"advance"` or `"dispatch"`), and defaults to `console.error`.
  - **A failed operation cancels operations queued behind it**, so `dispatch(move); advance();` no longer advances after a rejected move.
  - **Breaking:** `start`, `advance` and `dispatch` now return an `OperationResult`, a promise that resolves to `true` once applied or `false` if the operation failed or was cancelled. It never rejects, so existing fire-and-forget calls keep working. If you use typescript-eslint's `no-floating-promises`, add `OperationResult` from this package to `allowForKnownSafePromises`.
  - **Multiple `useGameEvent` handlers for the same event type** now all run. The engine waits for all of them and receives the first non-`undefined` response. Previously the last one registered replaced the others, and unmounting any of them removed the shared handler.
  - **`transitioning` now works.** It's `true` while an operation, including any `emit` it's waiting on, is in flight, so `canDispatch` returns `false` meanwhile. It's also returned by `useStateMachineEngineState`.
  - **`autostart` starts the machine once** under `<StrictMode>`.
  - **Breaking:** the internal `_registerEventHandler` is no longer part of the context value.

### Patch Changes

- [#39](https://github.com/drock07/board-game-toolkit/pull/39) [`7d3a0f3`](https://github.com/drock07/board-game-toolkit/commit/7d3a0f3573d550ce140566ae89fe793fc43f62ea) Thanks [@drock07](https://github.com/drock07)! - `CardHand` now keeps keyboard focus in bounds by deriving it during render instead of correcting it in an effect, so it never renders an out-of-range focus first. `UncontrolledCardHand` clears a selection whose card has left the hand during render, and still calls `onSelect(null)` once.

- [#37](https://github.com/drock07/board-game-toolkit/pull/37) [`ed23546`](https://github.com/drock07/board-game-toolkit/commit/ed2354649ae9fae3caf05e314c1b34f400944ee8) Thanks [@drock07](https://github.com/drock07)! - `CardHand` and `FeltBackground` no longer depend on Tailwind classes for their layout. Their default positioning and sizing are now inline styles, and `className` is passed through unchanged. They now lay out correctly in apps that don't use Tailwind, or whose Tailwind doesn't scan `node_modules`.

- Updated dependencies [[`e7e25e6`](https://github.com/drock07/board-game-toolkit/commit/e7e25e6e96ee04daaab394c916e508da6be49f93), [`41bcdc7`](https://github.com/drock07/board-game-toolkit/commit/41bcdc712d4a8fa5a52dccdc26d4deff7a43700e), [`02f86c3`](https://github.com/drock07/board-game-toolkit/commit/02f86c3741901a20030a2443ec1b90a50af86343)]:
  - @drock07/board-game-toolkit-core@1.0.0

## 0.4.0

### Minor Changes

- [`1306fc3`](https://github.com/drock07/board-game-toolkit/commit/1306fc3838ce186aa59e76001a1509fe7e05e56f) Thanks [@drock07](https://github.com/drock07)! - Add CardPool, CardStack, and CardGrid layout components.
  - `CardPool` — reads a named pool from `StateMachineContext` (requires `GenericCardGameState`) via render prop, keeping context access inside the component
  - `CardStack` — renders children as a stacked pile; supports a `stagger` prop for a scattered-pile effect (random per-card rotations and offsets) or a cast-shadow depth effect when omitted
  - `CardGrid` — lays out cards in a CSS grid; supports dense mode (pass children directly, optional `columns`) and sparse mode (pass a `(x, y) => ReactNode` render function with required `columns` and `rows` for positional card placement)

## 0.3.0

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

### Patch Changes

- Updated dependencies [[`2b1b359`](https://github.com/drock07/board-game-toolkit/commit/2b1b359b2a831a51ac7c7a272e665d6905ecb884)]:
  - @drock07/board-game-toolkit-core@0.5.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`f10128f`](https://github.com/drock07/board-game-toolkit/commit/f10128f8bd8e4a367a60e129a55a7ffb51592cb3)]:
  - @drock07/board-game-toolkit-core@0.4.0

## 0.2.4

### Patch Changes

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

- Updated dependencies [[`5200186`](https://github.com/drock07/board-game-toolkit/commit/5200186085fe88637154072dc59ef3e27cbe03ed)]:
  - @drock07/board-game-toolkit-core@0.3.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`506d071`](https://github.com/drock07/board-game-toolkit/commit/506d071639ae6e948e54e501b5678a1ff4012bb0)]:
  - @drock07/board-game-toolkit-core@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`a7ac103`](https://github.com/drock07/board-game-toolkit/commit/a7ac103c0d997ec39df260163967db0284e0ffbf)]:
  - @drock07/board-game-toolkit-core@0.2.2

## 0.2.1

### Patch Changes

- [`ddad6f7`](https://github.com/drock07/board-game-toolkit/commit/ddad6f72129b02a9487af389e4db25825ffb04e4) Thanks [@drock07](https://github.com/drock07)! - ### Core: Relax `onEnter` data parameter type

  Changed the `data` parameter in `onEnter` from `unknown` to `any`, allowing inline typing of the parameter without needing a cast (e.g., `onEnter: (state, data?: { round: number }) => ...`).

  ### React: Support unselecting cards in CardHand

  `CardHand` now toggles selection — clicking or activating an already-selected card calls `onCardClick` with `null`. The `onCardClick` type is updated from `(key: string) => void` to `(key: string | null) => void`.

- Updated dependencies [[`ddad6f7`](https://github.com/drock07/board-game-toolkit/commit/ddad6f72129b02a9487af389e4db25825ffb04e4)]:
  - @drock07/board-game-toolkit-core@0.2.1

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

### Patch Changes

- Updated dependencies [[`5526e9d`](https://github.com/drock07/board-game-toolkit/commit/5526e9d41bc6ad548f1307916c29d7ae1a3288ba)]:
  - @drock07/board-game-toolkit-core@0.2.0

## 0.1.0

### Minor Changes

- fdd72b6: Initial release

### Patch Changes

- Updated dependencies [fdd72b6]
  - @drock07/board-game-toolkit-core@0.1.0
