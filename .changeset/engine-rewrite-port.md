---
"@drock07/board-game-toolkit-engine": minor
---

Rewrite the engine on the design from the tutorial ladder (rung 9). Games are declared with `define<Vars>({ zones })`, typed handles (`entity`, `zone`, `action`) and flow builders; the spec is derived, not written. `apply` returns `{ ok, state, events }` instead of throwing on an illegal input. Views and events key entities by a public `ref`, renewed on shuffle. Effects (`tx.cause`) run with "before" and "after" abilities carried by entities in zones or declared game-wide. Custom node kinds are written against the new `./kinds` export. `immer` is no longer a dependency. Breaking: the previous `defineGame`/spec/impl API is removed.
