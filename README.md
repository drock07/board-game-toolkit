# Board Game Toolkit

A TypeScript toolkit for building board games with state machine-driven game flow.

## Packages

| Package | Description |
| --- | --- |
| [@drock07/board-game-toolkit-core](packages/core/) | Framework-agnostic state machine engine |
| [@drock07/board-game-toolkit-react](packages/react/) | React bindings (context, hooks, components) |

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
pnpm lint         # Lint all packages
```

### Project Structure

```
packages/
  core/     # State machine engine (no dependencies)
  react/    # React bindings (depends on core)
```
