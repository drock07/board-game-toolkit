// Three rounds, then a summary. Demonstrates loop with times, and iteration.
import {
  decision,
  defineGame,
  loop,
  pause,
  seq,
  step,
  type GameImpl,
  type GameSpec,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-loop",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { round: {}, score: {} },
  flow: loop(
    "session",
    seq("game", [
      step("reset", "reset"),
      loop(
        "rounds",
        seq("round", [
          step("startRound", "startRound"),
          decision("bet", { actor: "p1" }, { low: {}, high: {} }),
        ]),
        { times: 3 },
      ),
      pause("summary", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { round: number; score: number } }>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { round: 0, score: 0 };
  },
  steps: {
    reset(tx) {
      tx.vars = { round: 0, score: 0 };
    },
    startRound(tx) {
      // The nearest loop's pass, from 0
      tx.vars.round = tx.scope.iteration! + 1;
    },
  },
  actions: {
    low: { execute: (tx) => void (tx.vars.score += 1) },
    high: { execute: (tx) => void (tx.vars.score += tx.random.int(3)) },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
