---
"@drock07/board-game-toolkit-react": patch
---

`CardHand` now keeps keyboard focus in bounds by deriving it during render instead of correcting it in an effect, so it never renders an out-of-range focus first. `UncontrolledCardHand` clears a selection whose card has left the hand during render, and still calls `onSelect(null)` once.
