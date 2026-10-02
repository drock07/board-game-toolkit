// A guess, then two pauses: one anyone may continue, one only p2 may.
// Demonstrates pause.
import {
  decision,
  defineGame,
  loop,
  pause,
  seq,
  type GameImpl,
  type GameSpec,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-pause",
  version: 1,
  players: { min: 2, max: 2 },
  zones: {},
  vars: { guesses: {} },
  flow: loop(
    "rounds",
    seq("round", [
      decision("guess", { actor: "p1" }, { heads: {}, tails: {} }),
      // Anyone may continue (the default actor is "any")
      pause("reveal", { label: "Show the coin" }),
      // Only p2 may continue
      pause("handOver", { actor: "p2", label: "p2: next round" }),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { guesses: number } }>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { guesses: 0 };
  },
  actions: {
    heads: { execute: (tx) => void tx.vars.guesses++ },
    tails: { execute: (tx) => void tx.vars.guesses++ },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
