---
"@drock07/board-game-toolkit-core": minor
---

**Breaking:** randomness is now explicit and seeded, and games can be replayed.

- **Every helper that uses randomness takes a required trailing `rng`:**
  - `shuffle(items, rng)` and `shufflePool(state, pool, rng)`
  - `roll(die, rng)` and `roll(die, amount, rng)`, plus `sum`, `withAdvantage`, `withDisadvantage`, `keepHighest` and `keepLowest`
  - `draw` and `drawFromPool` when they reshuffle
  - `addToPool`, `moveCard`, `drawToPool`, `dealFromPool` and `splitPool` with position `"random"`

  Calls that don't involve randomness are unchanged.

- **New `random` module**, also available as the `/random` subpath:
  - `createRng(seed)`, a seeded mulberry32 generator with serializable state
  - `unseededRng`, for places where reproducibility doesn't matter
  - `randomSeed()`
- **The engine owns a seeded `rng`:**
  - `createEngine(initialState, { seed })` records the seed (a random one if omitted) and passes `rng` to `onEnter`, `onExit`, `execute` and `getNext`.
  - `getNext` now receives a context argument.
  - `EffectContext` requires an `rng` for the built-in effects.
- **`EngineState.history` is replaced by `log`**, which records every operation with the `emit` responses it received. The new `replay(config, initialState, { seed, log })` rebuilds a game exactly. `StateMachineEngine#history` is replaced by `log` and `seed`.
