---
"@drock07/board-game-toolkit-engine": minor
---

Add views: `view(game, state, viewer)` and `viewEvents(game, before, events, viewer)` hide what a player (or spectator) can't see, by zone visibility, `faceUp`, positional opaque ids and var visibility. Bots now receive views, and `fuzz` checks that no view or event stream leaks a hidden entity id.
