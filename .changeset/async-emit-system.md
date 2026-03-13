---
"@drock07/board-game-toolkit-core": minor
"@drock07/board-game-toolkit-react": minor
---

Add async emit system for state machine event coordination

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
