---
"@drock07/board-game-toolkit-engine": minor
---

Additions from porting the example games. Views carry `players`. Readers and transactions carry `shown`, so `turnNode.shown(s)` works in `validate`. `./testing` adds `playBots` and `SyncBot`, and `fuzz` accepts a list of seeds and reports its input count. `randomBot` is exported from the main entry. Fix: `playBots` no longer stops when the first bot that may act has nothing legal.
