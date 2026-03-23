---
"@drock07/board-game-toolkit-react": minor
---

Add CardPool, CardStack, and CardGrid layout components.

- `CardPool` — reads a named pool from `StateMachineContext` (requires `GenericCardGameState`) via render prop, keeping context access inside the component
- `CardStack` — renders children as a stacked pile; supports a `stagger` prop for a scattered-pile effect (random per-card rotations and offsets) or a cast-shadow depth effect when omitted
- `CardGrid` — lays out cards in a CSS grid; supports dense mode (pass children directly, optional `columns`) and sparse mode (pass a `(x, y) => ReactNode` render function with required `columns` and `rows` for positional card placement)
