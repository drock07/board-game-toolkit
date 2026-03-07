# @drock07/board-game-toolkit-core

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
