// A turn in three parts: draw, act, clean up. Demonstrates seq and step.
import {
  decision,
  defineGame,
  loop,
  seq,
  step,
  type GameImpl,
  type GameSpec,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-seq",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { log: {} },
  flow: loop(
    "turns",
    seq("turn", [
      step("draw", "drawCard"),
      decision("act", { actor: "p1" }, { play: {}, hold: {} }),
      step("cleanUp", "cleanUp"),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { log: string[] } }>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { log: [] };
  },
  steps: {
    drawCard: (tx) => void tx.vars.log.push("drew a card"),
    cleanUp: (tx) => void tx.vars.log.push("cleaned up"),
  },
  actions: {
    play: { execute: (tx) => void tx.vars.log.push("played") },
    hold: { execute: (tx) => void tx.vars.log.push("held") },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
