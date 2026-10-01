# @drock07/board-game-toolkit-engine

A pure, deterministic board game engine. Game state is plain JSON, rules code
changes it only through a transaction (`tx`), and every change is recorded as
an event that can be replayed.

> Under construction. The flow interpreter, `defineGame`, `init` and `apply`
> arrive in later milestones.

## State model

- **Entities** (cards, tokens, dice) live in exactly one **zone**. Zone index 0
  is the top. Entity ids are `type#n` from a deterministic counter and are
  never reused.
- **Vars** hold game-specific JSON. They are changed through an immer draft
  (`tx.vars`), and the patches become a single `vars` event per transaction.

## Transactions

| Op                                  | Event       | Notes                                                    |
| ----------------------------------- | ----------- | -------------------------------------------------------- |
| `create(type, props, zone, { at })` | `created`   | Defaults to the bottom, so creation order reads top-down |
| `move(ids, to, { at, faceUp })`     | `moved`     | Moves a block, keeping order. Defaults to the top        |
| `moveTop(from, to, count, opts)`    | `moved`     | Throws if `from` holds fewer than `count`                |
| `shuffle(zone)`                     | `shuffled`  | Uses the seeded RNG in state                             |
| `flip(id, faceUp)`                  | `flipped`   |                                                          |
| `destroy(id)`                       | `destroyed` |                                                          |
| `emit(name, payload, visibleTo)`    | `custom`    | Presentation only                                        |
| `end(result)`                       | `ended`     | Finishes the game                                        |

A move sets each entity's `faceUp` to the `faceUp` option, and omitting it
clears any override, so entities take on their new zone's visibility.

`reduceEvents(state, events)` rebuilds entities, zones, vars and status from
events. Hosts use it to step through intermediate states for animation.

## Randomness

The RNG is sfc32 with its four-uint32 state in `state.rng`. String seeds are
hashed with cyrb128 and the generator is warmed up for 12 rounds.
`tx.random` offers `int`, `float`, `pick`, `shuffle` and `roll(die)`; standard
dice (`D4`–`D20`, `D100`, `Fudge`) ship as data. `Math.random` and `Date` are
banned by lint in the engine and in game rules.
