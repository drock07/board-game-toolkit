---
"@drock07/board-game-toolkit-core": minor
---

Add card effect system for declarative card effects with reducer-style resolution

- Add `CardEffect` base interface and `EffectCard<TEffect>` for cards that carry effects
- Add `EffectContext<TCard>` for passing context (triggering card) to effect handlers
- Add `EffectHandler`, `EffectHandlerMap` types for mapping effect types to handler functions
- Add `resolveEffects()` for left-to-right fold of effects over game state
- Add built-in `TransferCardsEffect` (with `count: number | "all"` and `toPosition`) and `ShufflePoolEffect`
- Add `createBuiltinEffectHandlers()` factory for pool-based effect handlers that can be spread into custom handler maps
