// Hit until you stand or reach 21. Demonstrates decision with ends: false,
// endWhen, validate and then.
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
  id: "demo-decision",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { total: {} },
  flow: loop(
    "hands",
    seq("hand", [
      step("deal", "deal"),
      decision(
        "play",
        { actor: "p1", endWhen: "atOrOver21" },
        {
          hit: { ends: false },
          stand: {},
          double: { then: step("announceDouble", "announceDouble") },
        },
      ),
      pause("result", { label: "Next hand" }),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { total: number } }>;

// #region impl
const card = (tx: { random: { int(n: number): number } }) =>
  2 + tx.random.int(10);

export const impl = {
  setup(tx) {
    tx.vars = { total: 0 };
  },
  conditions: {
    atOrOver21: (s) => s.vars.total >= 21,
  },
  steps: {
    deal: (tx) => void (tx.vars.total = card(tx) + card(tx)),
    announceDouble: (tx) => void tx.emit("doubled", { total: tx.vars.total }),
  },
  actions: {
    hit: { execute: (tx) => void (tx.vars.total += card(tx)) },
    stand: { execute: () => {} },
    double: {
      validate: (s) =>
        s.vars.total <= 11 ? true : "Double only on 11 or less",
      execute: (tx) => void (tx.vars.total += card(tx)),
    },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
