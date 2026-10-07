# @drock07/board-game-toolkit-react

## 0.2.0

### Minor Changes

- [#60](https://github.com/drock07/board-game-toolkit/pull/60) [`447b284`](https://github.com/drock07/board-game-toolkit/commit/447b284dcda0a83f49b5cf0a2fe0903ba11eeda1) Thanks [@drock07](https://github.com/drock07)! - Zones can have `visibility: "top"`: everyone sees only the top entity, and the engine manages `faceUp` as the top changes. `move` and `moveTop` take `{ at: "bottom" }`. A `flow` event at the end of each input carries what the flow waits on and what its kinds show, so views replay exactly and a host's view stays in step during playback. `turns` shows `{ player, turn, round }` and `loop` shows `{ pass }` (`turnsNode.shown(view)`, `loopNode.shown(view)`). A kind's `show` receives a read context.

- [#60](https://github.com/drock07/board-game-toolkit/pull/60) [`e769da3`](https://github.com/drock07/board-game-toolkit/commit/e769da356711cd80dcb20f0248ff86628fadf74e) Thanks [@drock07](https://github.com/drock07)! - The React host runs on the rewritten engine. `useGame` returns `actors` (who may act now) and the viewer's typed `legal` inputs instead of `prompts`. Events play back onto the viewer's view, and `submit` returns a rejection reason. Bots are `(legal, { view, player, random }) => input`, so the engine's `randomBot(seed)` fits as is. They answer whenever their seat may act. New `useGameEffect(g, effect, (data, view) => …)` is typed by the effect. The devtools draw any spec, custom kinds included, through each kind's `children()`; `FiberInspector` shows the root stack, the fibers and the pending interrupt queue. In the engine, views gain `waiting` (open prompts with optional labels) and `shown` (what kinds publish, such as `turnNode.shown(view)`). `turn` is a built-in kind, and `viewEntities(view, zone)` reads a zone from a view. Setup `options` and the `pause` prompt kind are gone.

### Patch Changes

- Updated dependencies [[`d59510f`](https://github.com/drock07/board-game-toolkit/commit/d59510f77b754800b57c38135e9703610e4d2152), [`e6317fe`](https://github.com/drock07/board-game-toolkit/commit/e6317feb3817143503df114a00854737ccd1519e), [`3faf41c`](https://github.com/drock07/board-game-toolkit/commit/3faf41ce2c62fe38600afc6a23d6b0abf11467e5), [`cc2f136`](https://github.com/drock07/board-game-toolkit/commit/cc2f136b315374b366c649e28d14edeab11fb4b4), [`1277960`](https://github.com/drock07/board-game-toolkit/commit/1277960edcc20b6979b7dba9b74537e3faa5ef20), [`04430bc`](https://github.com/drock07/board-game-toolkit/commit/04430bce80f4f8ea27e1f210b858f152de7b8a71), [`447b284`](https://github.com/drock07/board-game-toolkit/commit/447b284dcda0a83f49b5cf0a2fe0903ba11eeda1), [`e769da3`](https://github.com/drock07/board-game-toolkit/commit/e769da356711cd80dcb20f0248ff86628fadf74e)]:
  - @drock07/board-game-toolkit-engine@0.2.0

## 0.1.1

### Patch Changes

- [#52](https://github.com/drock07/board-game-toolkit/pull/52) [`e1b1cf7`](https://github.com/drock07/board-game-toolkit/commit/e1b1cf7f82780a307ab285d4a7cfb3c6948a5466) Thanks [@drock07](https://github.com/drock07)! - `useGame` renders on the server: it passes the host's snapshot as the server snapshot, so server rendering (Next.js, Astro, `renderToString`) shows the opening state instead of throwing.

- Updated dependencies []:
  - @drock07/board-game-toolkit-engine@0.1.1

## 0.1.0

### Minor Changes

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`95b24b0`](https://github.com/drock07/board-game-toolkit/commit/95b24b002364cd9f7647d459b8417395dc8163cf) Thanks [@drock07](https://github.com/drock07)! - Replace the state-machine core with a new engine built around a data-first flow spec. This first step adds the state model, transactions and their events, `reduceEvents`, the seeded RNG and dice data. `@drock07/board-game-toolkit-core` is retired, and the React package is being rebuilt as a host for the new engine.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`1f0d865`](https://github.com/drock07/board-game-toolkit/commit/1f0d8656756125cee5cfb84489b438421d469d86) Thanks [@drock07](https://github.com/drock07)! - Add `@drock07/board-game-toolkit-react/devtools`: `FlowGraph` draws a game's flow and triggers as nested boxes and highlights the running and waiting nodes, and `FiberInspector` lists fibers with their frame stacks.

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`d6b0c66`](https://github.com/drock07/board-game-toolkit/commit/d6b0c66a09409b604769f33628a80047f907e002) Thanks [@drock07](https://github.com/drock07)! - Add the React host: `useGame` runs a game in a component, with the viewer's view, prompts and legal inputs, event playback that awaits `useGameEvent` handlers, and bots that answer their own prompts after a delay. `GameHost` is the framework-free class behind it.

### Patch Changes

- [#43](https://github.com/drock07/board-game-toolkit/pull/43) [`7ab053d`](https://github.com/drock07/board-game-toolkit/commit/7ab053d90b8b2607a576669d8d6c2157b10defde) Thanks [@drock07](https://github.com/drock07)! - The engine is now a regular dependency rather than a peer dependency, so it's installed with the React host. Publishing uses `changeset publish`, which tags each release and creates GitHub Releases.

- Updated dependencies [[`9a2b46c`](https://github.com/drock07/board-game-toolkit/commit/9a2b46c26a190553d8bec7085ee053db086d7f99), [`4129500`](https://github.com/drock07/board-game-toolkit/commit/4129500c405d7b243523145e8cf8e2925792942b), [`11ee375`](https://github.com/drock07/board-game-toolkit/commit/11ee37500cf326f9c39fca8cd26f389c442072b0), [`386789c`](https://github.com/drock07/board-game-toolkit/commit/386789cbf976bdb23370a9f7614850ad4ff74e19), [`1f0d865`](https://github.com/drock07/board-game-toolkit/commit/1f0d8656756125cee5cfb84489b438421d469d86), [`462cc1a`](https://github.com/drock07/board-game-toolkit/commit/462cc1ac92e0e14035294c66cdf5c3e1e6053b88), [`4da752b`](https://github.com/drock07/board-game-toolkit/commit/4da752b094d923b1683cc46534616c12c6c00806), [`8606524`](https://github.com/drock07/board-game-toolkit/commit/8606524541b7259c86c034b92aaffab88741a5f9), [`95b24b0`](https://github.com/drock07/board-game-toolkit/commit/95b24b002364cd9f7647d459b8417395dc8163cf), [`4c409ca`](https://github.com/drock07/board-game-toolkit/commit/4c409cadd756a16cdeeabd1d6c098457c241f280), [`cefe549`](https://github.com/drock07/board-game-toolkit/commit/cefe54913cc51aa08ca3fdcda6dcb76aba7c658f), [`d6b0c66`](https://github.com/drock07/board-game-toolkit/commit/d6b0c66a09409b604769f33628a80047f907e002)]:
  - @drock07/board-game-toolkit-engine@0.1.0
