---
"@drock07/board-game-toolkit-engine": minor
---

Engine API refinements on the rewrite. Every custom event is an effect: `effect<T>(name, { resolve?, to? })` replaces `event<T>()` and `tx.emit`. Effects register themselves (no `rules({ effects })`), and an ability reacts before one with `on: attack.before` instead of `timing: "before"`. Readers and transactions read a node's scope with `scopeOf(nodeId)`, replacing `scope` and `effect`. `everyone(...)` is shorthand for `simultaneous(prompt(...))`. `defineNode` no longer takes a `kind`. `tx.random` is the full seeded `Random` (`int`, `float`, `pick`, `shuffle`, `roll`), and dice are typed by their faces. There is one typed `Reader`/`Tx`.
