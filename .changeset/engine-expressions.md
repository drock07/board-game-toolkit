---
"@drock07/board-game-toolkit-engine": minor
---

Conditions can be JSON expressions as well as impl names: `var` paths into vars, locals and scope, `count` of a zone, comparisons, `and`/`or`/`not`, `add`/`sub`, and `ref` to call an impl condition. `defineGame` checks their shape, paths and zones, refs inside them are type-checked, and `describeCond` prints them readably.
