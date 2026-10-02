// Two dice duels per round, written once as a subflow.
// Demonstrates subflows, use (the subflow builder) and prefixed node ids.
import {
  D6,
  decision,
  defineGame,
  loop,
  seq,
  step,
  subflow,
  type GameImpl,
  type GameSpec,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-subflow",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { rolls: {} },
  flow: loop(
    "rounds",
    seq("round", [
      // Node ids inside are prefixed: "first.duel", "first.attack", …
      subflow("first", "duel"),
      subflow("second", "duel"),
    ]),
  ),
  subflows: {
    duel: seq("duel", [
      decision("attack", { actor: "p1" }, { roll: {} }),
      step("record", "recordDuel"),
    ]),
  },
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { rolls: number[] } }>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { rolls: [] };
  },
  steps: {
    recordDuel: (tx) => void tx.emit("duelOver"),
  },
  actions: {
    roll: {
      execute: (tx) => void tx.vars.rolls.push(tx.random.roll(D6) as number),
    },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
