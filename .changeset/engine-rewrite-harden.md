---
"@drock07/board-game-toolkit-engine": minor
---

Engine hardening on the rewrite. Errors are classes: `GameDefinitionError` and its subclasses `RulesError`, `UnhandledOutcomeError`, `FlowEndedWithoutEndError`, `FlowStuckError` and `AbilityLoopError` (the last two carry a trace). Definitions are checked when they're defined: entity-type names must be unique, player counts must be positive whole numbers, and an ability's zone and type must match. `save`/`load` stamp a state with the game's `specHash` and throw `SaveError` on a mismatch. `toJSON`/`fromJSON` handle specs, and `replayInputs` rebuilds a state from its input log. `./testing` adds `record`, `simulate` and `hashState` for golden replays, and `randomBot` is typed by the inputs it picks from. Fixes: a flow starting with `turns` no longer crashes at `init`, and an input's args match whatever their key order.
