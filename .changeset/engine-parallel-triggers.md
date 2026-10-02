---
"@drock07/board-game-toolkit-engine": minor
---

Add parallel flows and triggers. `parallel` runs branches in their own fibers and joins on all of them or races them; `each` with `mode: "parallel"` gives every player their own prompt at once. Triggers run a flow as an interrupt when an event matches, which allows response windows and nested reactions. `JsonCompatible` now accepts interfaces in unions with primitives, such as `Item | null`.
