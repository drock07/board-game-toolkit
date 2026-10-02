# @drock07/board-game-toolkit-react

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
