---
"@drock07/board-game-toolkit-core": patch
"@drock07/board-game-toolkit-react": patch
---

### Core: Relax `onEnter` data parameter type

Changed the `data` parameter in `onEnter` from `unknown` to `any`, allowing inline typing of the parameter without needing a cast (e.g., `onEnter: (state, data?: { round: number }) => ...`).

### React: Support unselecting cards in CardHand

`CardHand` now toggles selection — clicking or activating an already-selected card calls `onCardClick` with `null`. The `onCardClick` type is updated from `(key: string) => void` to `(key: string | null) => void`.
