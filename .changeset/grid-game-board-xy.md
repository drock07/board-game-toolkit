---
"@drock07/board-game-toolkit-react": minor
---

**Breaking:** `GridGameBoard` now calls its `children` render function with `(x, y)`, where `x` is the column and `y` is the row, as its type always declared and matching `CardGrid`. It previously passed `(row, column)`. If your callback relied on the old order, swap its parameters.

`GridGameBoard` also merges the caller's `style` into its grid styles instead of overwriting it.
