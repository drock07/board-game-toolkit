---
"@drock07/board-game-toolkit-engine": patch
---

Fixes found while writing the docs: a waiting node now runs once on entry, so a `turn` whose `until` already holds ends without waiting. `turnsNode.shown(view).turn` counts turns taken, not seats passed. The engine's entry points carry `@module` names for the API reference, and stale doc comments are fixed.
