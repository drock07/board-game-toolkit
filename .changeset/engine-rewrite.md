---
"@drock07/board-game-toolkit-engine": minor
"@drock07/board-game-toolkit-react": minor
---

Replace the state-machine core with a new engine built around a data-first flow spec. This first step adds the state model, transactions and their events, `reduceEvents`, the seeded RNG and dice data. `@drock07/board-game-toolkit-core` is retired, and the React package is being rebuilt as a host for the new engine.
