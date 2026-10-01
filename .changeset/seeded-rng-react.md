---
"@drock07/board-game-toolkit-react": minor
---

- **New `seed` prop** on `StateMachineContext` (and `withStateMachineContext`'s options) to reproduce a game. The component returned by `withStateMachineContext` also accepts a `seed` prop, which overrides the option (e.g. a seed read from the URL). `useStateMachineEngineState` now returns the engine's `seed`.
- **`CardStack`'s scatter** uses core's seeded generator. The pattern shifts slightly, once.
