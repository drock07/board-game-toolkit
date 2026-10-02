// Draft one or two of the items on offer. Demonstrates choose with a list
// ref, min and max.
import {
  choose,
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
  id: "demo-choose",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { offer: {}, kept: {} },
  flow: loop(
    "drafts",
    seq("draft", [
      step("refill", "refill"),
      choose("pick", {
        actor: "p1",
        options: "onOffer",
        min: 1,
        max: 2,
        apply: "keep",
      }),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<
  typeof spec,
  { vars: { offer: string[]; kept: string[] } }
>;

const ITEMS = ["sword", "shield", "potion", "map", "lantern", "rope"];

// #region impl
export const impl = {
  setup(tx) {
    tx.vars = { offer: [], kept: [] };
  },
  lists: {
    onOffer: (s) => [...s.vars.offer],
  },
  steps: {
    refill(tx) {
      tx.vars.offer = tx.random.shuffle(ITEMS).slice(0, 3);
    },
  },
  choices: {
    keep(tx, selection) {
      tx.vars.kept.push(...(selection as string[]));
    },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
