# @drock07/board-game-toolkit-engine

A pure, deterministic board game engine. Game state is plain JSON, rules code
changes it only through a transaction (`tx`), and every change is recorded as
an event that can be replayed.

> Under construction: `parallel`, triggers and views arrive in later
> milestones.

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
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

const spec = {
  id: "counter",
  version: 1,
  players: { min: 1, max: 1 },
  zones: { tokens: { visibility: "public" } },
  flow: loop("session", decision("turn", { actor: "p1" }, { add: {} }), {
    until: "atTen",
  }),
} as const;

interface Vars {
  n: number;
}
interface Token {
  color: "red" | "blue";
}
// Zone names come from the spec; vars and entity props are declared here
type Types = TypesFor<typeof spec, { vars: Vars; entities: { token: Token } }>;

const impl = {
  setup: (tx) => void (tx.vars = { n: 0 }),
  conditions: { atTen: (s) => s.vars.n >= 10 },
  actions: {
    add: {
      execute(tx) {
        tx.vars.n++;
        tx.create("token", { color: "red" }, "tokens");
      },
    },
  },
} satisfies GameImpl<Types>;

const game = defineGame({ spec, impl });
```

Every ref in the spec must exist in the impl and every impl entry must be
used; both are type errors. Typing the impl with `satisfies GameImpl<Types>`
types every handler while keeping its keys literal for that check, and
`defineGame` reads the game's types from the impl's `setup`.

With the type bundle, a misspelled zone (`"tokns"`), wrong entity props or an
unknown vars field is a compile error, entities narrow on `type`, and
`tx.local("nodeId")` returns that node's declared locals (add
`locals: { nodeId: Shape }` to the declaration). Vars, props and locals can be
interfaces or type aliases, but must be JSON-compatible: Date, Map, Set,
functions and required `undefined` values are rejected.

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

An `exit` node or `tx.exit(outcome)` in rules code raises an outcome, which
unwinds to the nearest enclosing node that handles it (`tx.exit` takes effect
when the transaction commits). Raising an outcome no enclosing node handles is
a definition error.

`subflow(id, name)` runs `spec.subflows[name]` in place, with the subflow's
node ids prefixed by `id`: `subflow("combat", "combat")` turns its `fight`
node into `combat.fight`. (The node kind is `use`; the builder isn't called
`use` because React's lint rules treat that name as a hook.)

A guard is also checked when its node is pushed again, before any of its
children run, so reset the state it watches before re-entering it.

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

States are typed `ReadonlyGameState<T>`. Each one shares its unchanged parts
with the states before it, so mutating one in place would corrupt the
history; the type forbids it, and the fuzzer freezes states to catch it.

## Randomness

The RNG is sfc32 with its four-uint32 state in `state.rng`. String seeds are
hashed with cyrb128 and the generator is warmed up for 12 rounds.
`tx.random` offers `int`, `float`, `pick`, `shuffle` and `roll(die)`; standard
dice (`D4`–`D20`, `D100`, `Fudge`) ship as data. `Math.random` and `Date` are
banned by lint in the engine and in game rules.

## Legal inputs and bots

`legalInputs(game, state, player)` lists every input a player could give now:
each action's `enumerate` args that pass `validate` (an action without
`enumerate` is offered with no args), every `choose` selection, and
`continue` for pauses. Bots build on it:

```ts
const bot: Bot<Types> = (state, prompt, { player, legal, random }) =>
  random.pick(legal);
```

`randomBot()` picks uniformly. Bots get their own RNG, so a game's
determinism depends only on the inputs they produce.

## Testing

`@drock07/board-game-toolkit-engine/testing` has:

- `fuzz(game, { seeds, maxInputs, players })`: plays random legal inputs and
  checks invariants, that legal inputs are accepted, the replay property and
  `replay` equality. It reports failures with their seeds, and warns about
  actions without `enumerate` that were never legal.
- `playBots(game, { players, seed, bots, maxInputs })`: plays synchronous bots.
- `record`, `simulate`, `hashState` and `expectPrompt` for golden replays.
