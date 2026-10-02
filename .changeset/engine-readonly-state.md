---
"@drock07/board-game-toolkit-engine": minor
---

States the engine returns are typed `ReadonlyGameState<T>`, since they share unchanged parts with earlier states and must never be mutated. `fuzz` deep-freezes every state before the next input, so a mutation bug throws, and `deepFreeze` is exported from `/testing`.
