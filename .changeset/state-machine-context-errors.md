---
"@drock07/board-game-toolkit-react": minor
---

`StateMachineContext` no longer swallows errors.

- **New `onError` prop** (also on `withStateMachineContext`'s options). It's called with the error and the operation (`"start"`, `"advance"` or `"dispatch"`), and defaults to `console.error`.
- **A failed operation cancels operations queued behind it**, so `dispatch(move); advance();` no longer advances after a rejected move.
- **Breaking:** `start`, `advance` and `dispatch` now return an `OperationResult`, a promise that resolves to `true` once applied or `false` if the operation failed or was cancelled. It never rejects, so existing fire-and-forget calls keep working. If you use typescript-eslint's `no-floating-promises`, add `OperationResult` from this package to `allowForKnownSafePromises`.
- **Multiple `useGameEvent` handlers for the same event type** now all run. The engine waits for all of them and receives the first non-`undefined` response. Previously the last one registered replaced the others, and unmounting any of them removed the shared handler.
- **`transitioning` now works.** It's `true` while an operation, including any `emit` it's waiting on, is in flight, so `canDispatch` returns `false` meanwhile. It's also returned by `useStateMachineEngineState`.
- **`autostart` starts the machine once** under `<StrictMode>`.
- **Breaking:** the internal `_registerEventHandler` is no longer part of the context value.
