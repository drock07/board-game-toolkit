# @drock07/board-game-toolkit-engine

## 0.1.1

## 0.1.0

### Minor Changes

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`9a2b46c`](https://github.com/drock07/board-game-toolkit/commit/9a2b46c26a190553d8bec7085ee053db086d7f99) Thanks [@drock07](https://github.com/drock07)! - Add `each` (over players or a list, with `repeat` and `until`) and `choose` flow nodes, `enumerate` on actions, `legalInputs`, the `Bot` type with `randomBot`, and `fuzz` and `playBots` in `/testing`. Transactions now copy only what they touch instead of drafting the whole state, which makes `apply` about five times faster.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`4129500`](https://github.com/drock07/board-game-toolkit/commit/4129500c405d7b243523145e8cf8e2925792942b) Thanks [@drock07](https://github.com/drock07)! - Add `exit` nodes and subflows: `exit` raises an outcome to the nearest node that handles it, and `subflow(id, name)` runs `spec.subflows[name]` with its node ids prefixed by `id`. `defineGame` rejects exits that nothing handles, unknown, unused or recursive subflows. Values can now move between a transaction's vars and locals.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`11ee375`](https://github.com/drock07/board-game-toolkit/commit/11ee37500cf326f9c39fca8cd26f389c442072b0) Thanks [@drock07](https://github.com/drock07)! - Conditions can be JSON expressions as well as impl names: `var` paths into vars, locals and scope, `count` of a zone, comparisons, `and`/`or`/`not`, `add`/`sub`, and `ref` to call an impl condition. `defineGame` checks their shape, paths and zones, refs inside them are type-checked, and `describeCond` prints them readably.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`386789c`](https://github.com/drock07/board-game-toolkit/commit/386789cbf976bdb23370a9f7614850ad4ff74e19) Thanks [@drock07](https://github.com/drock07)! - Add the flow spec and its interpreter: spec builders (`seq`, `loop`, `branch`, `step`, `decision`, `pause`, and more), `defineGame` with compile-time checking of impl refs, guards and handled outcomes, frame locals, and `init`, `apply`, `prompts` and `replay`. The `/testing` subpath adds `simulate`, `record`, `hashState` and `expectPrompt` for golden replays.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`462cc1a`](https://github.com/drock07/board-game-toolkit/commit/462cc1ac92e0e14035294c66cdf5c3e1e6053b88) Thanks [@drock07](https://github.com/drock07)! - Type games with one bundle instead of a vars type. `TypesFor<typeof spec, { vars, entities, locals }>` reads zone names from the spec, so misspelled zones, wrong entity props and unknown vars fields are compile errors, entities narrow on `type`, and `tx.local("node")` is typed. Vars, entity props and locals may be interfaces as well as type aliases; they're checked with `JsonCompatible`, which rejects Date, Map, Set, functions and required `undefined` values.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`4da752b`](https://github.com/drock07/board-game-toolkit/commit/4da752b094d923b1683cc46534616c12c6c00806) Thanks [@drock07](https://github.com/drock07)! - Add parallel flows and triggers. `parallel` runs branches in their own fibers and joins on all of them or races them; `each` with `mode: "parallel"` gives every player their own prompt at once. Triggers run a flow as an interrupt when an event matches, which allows response windows and nested reactions. `JsonCompatible` now accepts interfaces in unions with primitives, such as `Item | null`.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`8606524`](https://github.com/drock07/board-game-toolkit/commit/8606524541b7259c86c034b92aaffab88741a5f9) Thanks [@drock07](https://github.com/drock07)! - States the engine returns are typed `ReadonlyGameState<T>`, since they share unchanged parts with earlier states and must never be mutated. `fuzz` deep-freezes every state before the next input, so a mutation bug throws, and `deepFreeze` is exported from `/testing`.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`95b24b0`](https://github.com/drock07/board-game-toolkit/commit/95b24b002364cd9f7647d459b8417395dc8163cf) Thanks [@drock07](https://github.com/drock07)! - Replace the state-machine core with a new engine built around a data-first flow spec. This first step adds the state model, transactions and their events, `reduceEvents`, the seeded RNG and dice data. `@drock07/board-game-toolkit-core` is retired, and the React package is being rebuilt as a host for the new engine.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`4c409ca`](https://github.com/drock07/board-game-toolkit/commit/4c409cadd756a16cdeeabd1d6c098457c241f280) Thanks [@drock07](https://github.com/drock07)! - Add `toJSON(spec)` and `fromJSON(text)` to save and load specs. `fromJSON` checks the document's shape and reports each problem with its path; `defineGame` accepts the loaded spec with an impl, checking refs at runtime.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`cefe549`](https://github.com/drock07/board-game-toolkit/commit/cefe54913cc51aa08ca3fdcda6dcb76aba7c658f) Thanks [@drock07](https://github.com/drock07)! - Add views: `view(game, state, viewer)` and `viewEvents(game, before, events, viewer)` hide what a player (or spectator) can't see, by zone visibility, `faceUp`, positional opaque ids and var visibility. Bots now receive views, and `fuzz` checks that no view or event stream leaks a hidden entity id.

### Patch Changes

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`1f0d865`](https://github.com/drock07/board-game-toolkit/commit/1f0d8656756125cee5cfb84489b438421d469d86) Thanks [@drock07](https://github.com/drock07)! - Export the `FlowState`, `Fiber` and `Frame` types for devtools.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`d6b0c66`](https://github.com/drock07/board-game-toolkit/commit/d6b0c66a09409b604769f33628a80047f907e002) Thanks [@drock07](https://github.com/drock07)! - `isHidden` narrows view entities of any game's types, and `VisibleEntity<T>` names the entities a viewer can see.
