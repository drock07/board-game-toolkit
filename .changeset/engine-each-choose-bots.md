---
"@drock07/board-game-toolkit-engine": minor
---

Add `each` (over players or a list, with `repeat` and `until`) and `choose` flow nodes, `enumerate` on actions, `legalInputs`, the `Bot` type with `randomBot`, and `fuzz` and `playBots` in `/testing`. Transactions now copy only what they touch instead of drafting the whole state, which makes `apply` about five times faster.
