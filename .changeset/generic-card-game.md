---
"@drock07/board-game-toolkit-core": minor
"@drock07/board-game-toolkit-react": patch
---

Add generic card game pool utilities and fix CardHand key/focus bugs

**Core:**
- Add `GenericCardInstance` and `GenericCardGameState` interfaces for building custom card games
- Add 13 pool manipulation functions: `addToPool`, `removeFromPool`, `drawFromPool`, `shufflePool`, `moveCard`, `drawToPool`, `findInPool`, `dealFromPool`, `peekPool`, `sortPool`, `countInPool`, `splitPool`, `swapCards`
- Add `PoolIdOf` and `CardOf` helper types for deriving types from state
- All functions preserve extended state types via `TState extends GenericCardGameState` generics
- Add JSDoc to `draw`, `shuffle`, and all `playing-cards` exports

**React:**
- Fix `getItemKey` stripping React's `.$` key prefix from `Children.toArray`
- Fix first card appearing selected on mount by deferring focus index until interaction
- Sync `focusedIndex` with clicked card to prevent stale focus indicator
