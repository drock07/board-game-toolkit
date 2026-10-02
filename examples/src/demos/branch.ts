// Roll a die; odd and even rolls lead to different flows.
// Demonstrates branch with a named condition, an expression, and else.
import {
  branch,
  D6,
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
  id: "demo-branch",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { roll: {} },
  flow: loop(
    "turns",
    seq("turn", [
      decision("start", { actor: "p1" }, { roll: {} }),
      branch(
        "outcome",
        [
          {
            when: { eq: [{ var: "vars.roll" }, 6] },
            then: step("jackpot", "jackpot"),
          },
          {
            when: "rolledEven",
            then: pause("even", { label: "Even: continue" }),
          },
        ],
        pause("odd", { label: "Odd: continue" }),
      ),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { roll: number } }>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { roll: 0 };
  },
  conditions: {
    rolledEven: (s) => s.vars.roll % 2 === 0,
  },
  steps: {
    jackpot: (tx) => void tx.emit("jackpot"),
  },
  actions: {
    roll: {
      execute: (tx) => void (tx.vars.roll = tx.random.roll(D6) as number),
    },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
