// Each player takes a turn, in seat order, until someone reaches 3.
// Demonstrates each over players with repeat and until.
import {
  decision,
  defineGame,
  each,
  loop,
  pause,
  seq,
  step,
  type GameImpl,
  type GameSpec,
  type PlayerId,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-each",
  version: 1,
  players: { min: 2, max: 4 },
  zones: {},
  vars: { points: {} },
  flow: loop(
    "session",
    seq("game", [
      step("reset", "reset"),
      each(
        "turns",
        { players: "clockwise", from: "random" },
        decision("turn", { actor: "current" }, { score: {}, pass: {} }),
        { repeat: true, until: "someoneHasThree" },
      ),
      pause("over", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<
  typeof spec,
  { vars: { points: Record<PlayerId, number> } }
>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { points: {} };
  },
  conditions: {
    someoneHasThree: (s) => Object.values(s.vars.points).some((n) => n >= 3),
  },
  steps: {
    reset(tx) {
      tx.vars.points = Object.fromEntries(tx.state.players.map((p) => [p, 0]));
    },
  },
  actions: {
    score: {
      // The current player is the actor
      execute: (tx) => void (tx.vars.points[tx.scope.actor!]! += 1),
    },
    pass: { execute: () => {} },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
