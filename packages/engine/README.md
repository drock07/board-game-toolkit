# @drock07/board-game-toolkit-engine

A pure, deterministic board game engine. Game state is plain JSON, rules code
changes it only through a transaction (`tx`), and every change is recorded as
an event that can be replayed.

See the [documentation](https://drock07.github.io/board-game-toolkit/) for
guides and live examples. For React, see
[`@drock07/board-game-toolkit-react`](../react).

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

## Parallel flows and triggers

`parallel(id, children, { join })` runs each child in its own fiber: `all`
waits for every one, `race` ends on the first and cancels the rest. An
`each` with `mode: "parallel"` gives each player (or item) a fiber, so every
player answers their own prompt at once (simultaneous bids). Several prompts
can be open together; spawned fibers see their parent's scope and locals.

A trigger runs a flow when an event matches:

```ts
triggers: [{
  id: "plusTwo",
  on: { type: "moved", from: "hand", to: "discard", entityType: "card" },
  when: "plusTwoPlayed", // sees the event as scope.event
  flow: seq("window", [...]),
}]
```

The flow runs as an interrupt on the fiber whose transaction produced the
event, before that fiber continues. Interrupts may wait on prompts (a
response window), and their own events can fire further triggers, which
nest. Triggers fire by priority, then declaration order, then
`spec.triggerOrder` (`"fifo"` by default). They never fire on vars, locals
or shuffles; use a guard to react to vars.

## Expressions

Anywhere a condition goes (`exits`, `until`, `while`, `endWhen`, branch
`when`, trigger `when`), you can write a JSON expression instead of naming an
impl condition:

```ts
exits: {
  won: { lte: [{ var: "vars.enemy.hp" }, 0] },
  lost: { and: [{ ref: "playerDead" }, { not: { var: "scope.player" } }] },
}
```

- `{ var: "vars.…" | "local.…" | "scope.…" }` reads a path; missing paths
  are `null`. `local.` reads the nearest enclosing locals.
- `{ count: "hand:$player" }` counts a zone; `$player` is `scope.player`.
  (An `each`'s own `until` runs outside the player binding.)
- `eq`, `ne` (JSON equality); `lt`, `lte`, `gt`, `gte`, `add`, `sub`
  (numbers only); `and`, `or`, `not` (booleans only).
- `{ ref: "name" }` calls an impl condition, and is type-checked like any
  other ref.

An object operand is always an expression; strings, numbers, booleans, null
and arrays are literals. `defineGame` checks every expression's shape, path
roots, declared vars and zone names. A condition must evaluate to `true` or
`false`. `describeCond(cond)` prints one readably (`vars.enemy.hp <= 0`).

## Specs as JSON

A spec is plain data, so it can be saved, diffed and loaded:

```ts
import {
  defineGame,
  fromJSON,
  toJSON,
} from "@drock07/board-game-toolkit-engine";

const text = toJSON(spec); // { "format": "board-game-toolkit/spec", "formatVersion": 1, "spec": … }
const game = defineGame({ spec: fromJSON(text), impl });
```

`fromJSON` checks the document's shape (node kinds and their fields,
conditions and expressions, zones, vars, triggers) and reports every problem
with its path, such as `spec.flow.children[2].actions.hit.then: …`. Unknown
fields are errors, which catches typos. Custom node kinds pass with their
`id` checked; `defineGame` checks the rest as usual. A loaded spec's type is
the plain `GameSpec`, so impl refs are checked at runtime instead of by the
compiler.

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

## Views and hidden information

`view(game, state, viewer)` is what one player (or `"spectator"`) may see:

- An entity shows if its zone allows it (`public`; `owner` for the zone's
  owner; `top` for the top item; a custom `{ ref }` function), and `faceUp`
  overrides the zone either way. Hidden entities become positional opaque
  ids like `?deck#3`, so a shuffle reveals nothing; `revealType` keeps their
  type.
- Vars marked `visibility: "hidden"` are dropped, and `"owner"` vars (a
  record by player) keep only the viewer's entry.
- Other players' prompts lose their options, locals are public, and the RNG
  and flow internals are left out.

`viewEvents(game, before, events, viewer)` applies the same rules to
events, given the state before them: a move shows an entity's real id to
viewers who can see either end. Bots receive views, so they can't cheat.

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
  checks invariants, that legal inputs are accepted, the replay property,
  `replay` equality, and that no view or event stream leaks a hidden entity
  id. It reports failures with their seeds, and warns about
  actions without `enumerate` that were never legal.
- `playBots(game, { players, seed, bots, maxInputs })`: plays synchronous bots.
- `record`, `simulate`, `hashState` and `expectPrompt` for golden replays.
