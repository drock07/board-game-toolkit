# @drock07/board-game-toolkit-engine

A pure, deterministic board game engine. Game state is plain JSON, rules code
changes it only through a transaction (`tx`), and every change is recorded as
an event that can be replayed.

> Under construction: `each`, `choose`, `parallel`, triggers and views arrive
> in later milestones.

## Defining a game

A game is a **spec** (JSON data: zones, vars and a flow tree) plus an **impl**
(named TypeScript functions the spec refers to by name).

```ts
import {
  apply,
  decision,
  defineGame,
  init,
  loop,
  type GameImpl,
} from "@drock07/board-game-toolkit-engine";

const spec = {
  id: "counter",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  flow: loop("session", decision("turn", { actor: "p1" }, { add: {} }), {
    until: "atTen",
  }),
} as const;

type Vars = { n: number };

const impl = {
  setup: (tx) => void (tx.vars = { n: 0 }),
  conditions: { atTen: (s) => s.vars.n >= 10 },
  actions: { add: { execute: (tx) => void tx.vars.n++ } },
} satisfies GameImpl<Vars>;

const game = defineGame({ spec, impl });
```

Every ref in the spec must exist in the impl and every impl entry must be
used; both are type errors. Type the impl with `satisfies GameImpl<Vars>` so
handlers are typed while its keys stay literal for that check.

The game only moves forward on player input:

```ts
const { state, prompts } = init(game, { players: ["p1"], seed: "abc" });
const res = apply(game, state, {
  prompt: prompts[0]!.id,
  player: "p1",
  action: "add",
});
if (!res.ok) console.log(res.error.code); // invalid inputs return errors
```

Guards (`exits: { outcome: condition }`) are checked outermost first whenever
a frame is pushed and after every transaction. A node that lists an outcome
in `exits` or `on` handles it: its `on` flow runs, then its parent continues.

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
