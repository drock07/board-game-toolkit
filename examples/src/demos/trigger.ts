// Draw cards; drawing a bomb interrupts the turn to defuse it.
// Demonstrates a trigger on a moved event, with a when condition.
import {
  decision,
  defineGame,
  loop,
  type GameImpl,
  type GameSpec,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-trigger",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {
    deck: { visibility: "hidden" },
    hand: { visibility: "public" },
  },
  vars: { defused: {} },
  flow: loop(
    "turns",
    decision("turn", { actor: "p1" }, { draw: { ends: false }, reset: {} }),
  ),
  triggers: [
    {
      id: "bomb",
      // Any card moving into the hand...
      on: { type: "moved", to: "hand", entityType: "card" },
      // ...that is a bomb
      when: "drewBomb",
      // Interrupts the turn decision until the bomb is defused
      flow: decision("defuse", { actor: "p1" }, { cutWire: {} }),
    },
  ],
} as const satisfies GameSpec;
// #endregion spec

interface Card {
  bomb: boolean;
}
type Types = TypesFor<
  typeof spec,
  { vars: { defused: number }; entities: { card: Card } }
>;

// #region impl
export const impl = {
  setup(tx) {
    for (let i = 0; i < 8; i++) tx.create("card", { bomb: i < 2 }, "deck");
    tx.shuffle("deck");
    tx.vars = { defused: 0 };
  },
  conditions: {
    // In a trigger, scope.event is the event that fired it
    drewBomb: (s, scope) =>
      scope.event?.type === "moved" && s.entity(scope.event.ids[0]!).props.bomb,
  },
  actions: {
    draw: {
      validate: (s) => (s.count("deck") > 0 ? true : "The deck is empty"),
      execute: (tx) => void tx.moveTop("deck", "hand"),
    },
    reset: {
      execute(tx) {
        tx.move(tx.state.zones.hand.items, "deck");
        tx.shuffle("deck");
      },
    },
    cutWire: { execute: (tx) => void tx.vars.defused++ },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
