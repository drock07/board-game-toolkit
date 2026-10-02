# @drock07/board-game-toolkit-react

The React host for
[`@drock07/board-game-toolkit-engine`](../engine), which it depends on and
installs for you (the two are always released together): it runs a game in a
component, plays events back one at a time so the UI can animate them, and
lets bots answer their prompts.

```tsx
import { randomBot } from "@drock07/board-game-toolkit-engine";
import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";

function Table() {
  const g = useGame(myGame, {
    players: ["p1", { id: "p2", controller: randomBot() }],
  });
  // Playback waits for the promise, so each card lands before the next moves
  useGameEvent(g, "moved", () => new Promise((r) => setTimeout(r, 250)));

  return g.legal.map((input) => (
    <button key={JSON.stringify(input)} onClick={() => g.submit(input)}>
      {"action" in input ? input.action : "Continue"}
    </button>
  ));
}
```

## `useGame(game, options)`

Options:

- `players`: seats in order. A bare id is a human seat; `{ id, controller }`
  sets a bot.
- `seed`: defaults to a random one.
- `viewer`: whose view to show. Defaults to the first human seat.
- `botDelay`: milliseconds a bot waits before answering (default 500).

It returns:

- `view`: the viewer's `PlayerView`. During playback it lags the committed
  state, one event at a time.
- `prompts`, `legal`: the viewer's open prompts and legal inputs. Both are
  empty while events play back, and for a spectator or a bot's seat.
- `submit(input)`: applies an input. Returns the engine's error if it was
  rejected.
- `playing`: true while events are playing back.
- `log`: the viewer's events so far.
- `restart(seed?)`, `setViewer(viewer)`.
- `state`: the committed state with nothing hidden. Use it for inspectors and
  devtools; render the game from `view`.

The game and seats are read once. To change them, remount the component, for
example with a `key`.

## `useGameEvent(g, type, handler)`

Runs `handler(event, view)` as each of the viewer's events of `type` plays
back (`"*"` for all). The view already includes the event. If the handler
returns a promise, playback waits for it before the next event. Events
without handlers are applied straight away, without a render in between.

## Bots

A bot answers when one of its prompts is open and playback has finished. It
sees only its own view, and gets its own RNG seeded from the game's seed, so
the game's determinism depends only on the inputs it produces. A pause that a
human can answer is left to the human, so people set the pace between hands.

## `GameHost`

`useGame` wraps `GameHost`, a framework-free class with the same commands
plus `subscribe` and `getSnapshot`, for other UI libraries or tests.

## Devtools

`@drock07/board-game-toolkit-react/devtools` has two components for
inspecting a running game. Both use inline styles, themed by `--bgt-dt-*`
CSS variables (`--bgt-dt-bg`, `--bgt-dt-fg`, `--bgt-dt-accent`, …) so they
fit light or dark pages.

```tsx
import { FiberInspector, FlowGraph } from "@drock07/board-game-toolkit-react/devtools";

<FlowGraph game={game} flow={g.state.flow} />
<FiberInspector flow={g.state.flow} />
```

- `FlowGraph` draws the flow and its triggers as nested boxes: sequences run
  left to right; branch cases, parallel lanes, actions' `then` flows and
  `on` flows stack; loops are marked ↻. Each box lists its guards,
  conditions (via `describeCond`), actors and refs. Given a flow state,
  running nodes are outlined and nodes waiting for input are filled.
- `FiberInspector` lists live fibers with their frame stacks: node, phase,
  binding, locals and open prompt.
