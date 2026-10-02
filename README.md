# Board Game Toolkit

A TypeScript toolkit for building board games. A game's flow (phases, rounds,
turns, decisions) is a JSON-serializable spec interpreted by a pure,
deterministic engine: `apply(game, state, input) → { state, events, prompts }`.

**[Documentation and live examples](https://drock07.github.io/board-game-toolkit/)**

> The engine is pre-1.0. Expect breaking changes between minor versions.

## Packages

| Package                                                | Description                                       |
| ------------------------------------------------------ | ------------------------------------------------- |
| [@drock07/board-game-toolkit-engine](packages/engine/) | State model, ops, seeded RNG, flow interpreter    |
| [@drock07/board-game-toolkit-react](packages/react/)   | React host: hooks, event playback, bots, devtools |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

### Setup

```bash
pnpm install
```

### Scripts

```bash
pnpm build        # Build all packages
pnpm dev          # Watch mode for all packages
pnpm test         # Run tests across all packages
pnpm typecheck    # Type-check all packages, including tests
pnpm lint         # Lint the whole repo with ESLint (run pnpm build first)
pnpm format       # Format with Prettier (format:check to verify)
pnpm dev:docs     # Run the docs site locally
```

### Project Structure

```
packages/
  engine/   # The engine: no UI, only depends on immer
  react/    # React host (depends on engine)
examples/   # Example games, their UIs and tests, and the docs' code snippets
docs/       # The docs site (Astro + Starlight), deployed on each release
```
