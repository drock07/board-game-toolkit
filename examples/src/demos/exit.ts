// Push your luck: keep drawing until you stop, or bust. Demonstrates exits
// (a guard), on, tx.exit and the exit node.
import {
  decision,
  defineGame,
  exit,
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
  id: "demo-exit",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { total: {}, banked: {} },
  flow: loop(
    "session",
    seq("game", [
      step("reset", "reset"),
      loop(
        "draws",
        decision(
          "next",
          { actor: "p1" },
          {
            draw: {},
            bank: {},
            // An exit node raises "forfeit" from the flow
            quit: { then: exit("giveUp", "forfeit") },
          },
        ),
        {
          // A guard, checked after every transaction
          exits: { bust: { gt: [{ var: "vars.total" }, 10] } },
          // What to do after each outcome; then the loop is done
          on: {
            bust: pause("busted", { label: "Bust! Try again" }),
            banked: step("bankTotal", "bankTotal"),
            forfeit: pause("forfeited", { label: "Gave up" }),
          },
        },
      ),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<typeof spec, { vars: { total: number; banked: number } }>;

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { total: 0, banked: 0 };
  },
  steps: {
    reset: (tx) => void (tx.vars.total = 0),
    bankTotal(tx) {
      tx.vars.banked += tx.vars.total;
      tx.vars.total = 0;
    },
  },
  actions: {
    draw: { execute: (tx) => void (tx.vars.total += 1 + tx.random.int(4)) },
    // Raises "banked" from rules code; the draws loop handles it
    bank: { execute: (tx) => void tx.exit("banked") },
    quit: { execute: () => {} },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
