---
"@drock07/board-game-toolkit-core": patch
---

Stop publishing compiled test files in `dist`. Test files now go through a separate build tsconfig, so the published package no longer includes `*.test.js` files that import `vitest`.
