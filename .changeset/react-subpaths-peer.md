---
"@drock07/board-game-toolkit-react": minor
---

**Breaking:** packaging and export changes.

- **`@drock07/board-game-toolkit-core` is now a peer dependency.** Install it alongside this package. Core and react are now versioned together.
- **`PATTERNS` is renamed to `CARD_BACK_PATTERNS`.**

Also:

- **New domain subpaths** alongside the root: `/backgrounds`, `/boards`, `/cards`, `/dice` and `/state-machine`.
- **`useRollingAnimation` is now exported.**
- **The published ESM now loads in Node** (its relative imports now include `.js` extensions).
- **Package metadata:** the package declares `"sideEffects": false` and `"engines": { "node": ">=22" }`, and no longer sets `"main"`.
