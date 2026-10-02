---
"@drock07/board-game-toolkit-engine": minor
---

Add `exit` nodes and subflows: `exit` raises an outcome to the nearest node that handles it, and `subflow(id, name)` runs `spec.subflows[name]` with its node ids prefixed by `id`. `defineGame` rejects exits that nothing handles, unknown, unused or recursive subflows. Values can now move between a transaction's vars and locals.
