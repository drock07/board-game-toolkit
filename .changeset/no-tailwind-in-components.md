---
"@drock07/board-game-toolkit-react": patch
---

`CardHand` and `FeltBackground` no longer depend on Tailwind classes for their layout. Their default positioning and sizing are now inline styles, and `className` is passed through unchanged. They now lay out correctly in apps that don't use Tailwind, or whose Tailwind doesn't scan `node_modules`.
