---
"@drock07/board-game-toolkit-engine": minor
---

Add `toJSON(spec)` and `fromJSON(text)` to save and load specs. `fromJSON` checks the document's shape and reports each problem with its path; `defineGame` accepts the loaded spec with an impl, checking refs at runtime.
