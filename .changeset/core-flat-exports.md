---
"@drock07/board-game-toolkit-core": minor
---

**Breaking:** core now exports everything by name, from the root and from domain subpaths.

- **The `Cards`, `Dice` and `StateMachine` namespace exports are removed.** Import functions directly:
  - from the root: `import { shuffle, roll, createEngine } from "@drock07/board-game-toolkit-core"`
  - or from a subpath: `/cards`, `/dice` or `/state-machine`

  To keep a namespace, use `import * as Cards from "@drock07/board-game-toolkit-core/cards"`.

- **The `./stateMachine` subpath is renamed to `./state-machine`.**
- **`StateMachineEngine#getCurrentStateForMachine` is renamed to `getMachineCurrentState`**, matching the standalone function.

Also:

- **The published ESM now loads in Node.** Relative imports in `dist` were missing their `.js` extensions, so the package only worked through a bundler.
- **Transition signals use a registered symbol** (`Symbol.for("board-game-toolkit.transition")`), so they keep working if two copies of core end up in one bundle.
- **Package metadata:** the package declares `"sideEffects": false` and `"engines": { "node": ">=22" }`, and no longer sets `"main"`.
