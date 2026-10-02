// A buzzer race: both players may buzz, first one wins the point. Then both
// confirm, in any order. Demonstrates parallel with race and all.
import {
  decision,
  defineGame,
  loop,
  parallel,
  pause,
  seq,
  type GameImpl,
  type GameSpec,
  type PlayerId,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-parallel",
  version: 1,
  players: { min: 2, max: 2 },
  zones: {},
  vars: { wins: {} },
  flow: loop(
    "questions",
    seq("question", [
      parallel(
        "buzzers",
        [
          decision("p1Buzz", { actor: "p1" }, { buzz: {} }),
          decision("p2Buzz", { actor: "p2" }, { buzz: {} }),
        ],
        { join: "race" },
      ),
      parallel(
        "ready",
        [
          pause("p1Ready", { actor: "p1", label: "Ready" }),
          pause("p2Ready", { actor: "p2", label: "Ready" }),
        ],
        { join: "all" },
      ),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<
  typeof spec,
  { vars: { wins: Record<PlayerId, number> } }
>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { wins: { p1: 0, p2: 0 } };
  },
  actions: {
    buzz: {
      execute: (tx) => void (tx.vars.wins[tx.scope.actor!]! += 1),
    },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
