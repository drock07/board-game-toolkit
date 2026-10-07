---
"@drock07/board-game-toolkit-react": minor
"@drock07/board-game-toolkit-engine": minor
---

The React host runs on the rewritten engine. `useGame` returns `actors` (who may act now) and the viewer's typed `legal` inputs instead of `prompts`. Events play back onto the viewer's view, and `submit` returns a rejection reason. Bots are `(legal, { view, player, random }) => input`, so the engine's `randomBot(seed)` fits as is. They answer whenever their seat may act. New `useGameEffect(g, effect, (data, view) => …)` is typed by the effect. The devtools draw any spec, custom kinds included, through each kind's `children()`; `FiberInspector` shows the root stack, the fibers and the pending interrupt queue. In the engine, views gain `waiting` (open prompts with optional labels) and `shown` (what kinds publish, such as `turnNode.shown(view)`). `turn` is a built-in kind, and `viewEntities(view, zone)` reads a zone from a view. Setup `options` and the `pause` prompt kind are gone.
