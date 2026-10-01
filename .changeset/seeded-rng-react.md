---
"@drock07/board-game-toolkit-react": minor
---

- **New `seed` prop** on `StateMachineContext` (and `withStateMachineContext`'s options) to reproduce a game. `useStateMachineEngineState` now returns the engine's `seed`.
- **`CardStack`'s scatter** uses core's seeded generator. The pattern shifts slightly, once.
