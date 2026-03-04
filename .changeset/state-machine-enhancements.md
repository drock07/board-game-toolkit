---
"@drock07/board-game-toolkit-core": minor
---

### Action-triggered state transitions

Actions can now trigger state transitions directly from `execute` using a `transitionTo` helper passed as the third argument. This decouples "this action needs a resolution state" from "I'm done with this state" (`advance()`).

```ts
execute: (state, cmd, transitionTo) => {
  const newState = { ...state, pending: true };
  return transitionTo("resolveOverflow", newState);
}
```

### Transition data

Both `getNext` and `transitionTo` can now pass data to the target state's `onEnter`:

```ts
// From getNext — use a tuple
getNext: (state) => ["gameOver", { result: state.winner }]

// From action-triggered transitions — optional third arg
transitionTo("resolveOverflow", newState, { returnTo: "playCards" })

// Received in onEnter as the second argument
onEnter: (state, data) => {
  const { result } = data as { result: string };
  return { ...state, gameResult: result };
}
```

### Breaking: `onExit` now runs after `getNext`

Previously, `onExit` ran before `getNext` during `advance()`. Now `getNext` runs first (routing decision), then `onExit` (cleanup). This means `getNext` sees the pre-exit state, which is more intuitive for routing decisions that depend on state values modified by `onExit`.

The engine internals have been simplified to two core functions (`enterState` and `resolveNext`) that handle all state transitions, replacing the previous `transitionTo`/`startMachine`/`completeMachine` decomposition.
