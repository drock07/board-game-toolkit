---
"@drock07/board-game-toolkit-engine": minor
"@drock07/board-game-toolkit-react": minor
---

Zones can have `visibility: "top"`: everyone sees only the top entity, and the engine manages `faceUp` as the top changes. `move` and `moveTop` take `{ at: "bottom" }`. A `flow` event at the end of each input carries what the flow waits on and what its kinds show, so views replay exactly and a host's view stays in step during playback. `turns` shows `{ player, turn, round }` and `loop` shows `{ pass }` (`turnsNode.shown(view)`, `loopNode.shown(view)`). A kind's `show` receives a read context.
