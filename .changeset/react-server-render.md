---
"@drock07/board-game-toolkit-react": patch
---

`useGame` renders on the server: it passes the host's snapshot as the server snapshot, so server rendering (Next.js, Astro, `renderToString`) shows the opening state instead of throwing.
