// Take a factory's tiles into one of your pattern lines; a line that reaches
// its size scores and empties. Demonstrates zone families: a counted zone
// sized by the seating, per-player counted zones, zonesOf, and a trigger on
// any zone in a family.
import {
  decision,
  defineGame,
  each,
  loop,
  seq,
  step,
  type GameImpl,
  type GameSpec,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "demo-families",
  version: 1,
  players: { min: 2, max: 4 },
  zones: {
    bag: { visibility: "hidden" },
    // factory:0 … factory:n, one more than there are players
    factory: { count: { ref: "factories" }, visibility: "public" },
    // patternLine:p1:0 … patternLine:p1:2, and the same for each player
    patternLine: { perPlayer: true, count: 3, visibility: "public" },
  },
  vars: { scored: {} },
  flow: loop(
    "rounds",
    seq("round", [
      step("refill", "refill"),
      each(
        "turns",
        { players: "clockwise" },
        decision("turn", { actor: "current" }, { take: {} }),
        { until: "factoriesEmpty", repeat: true },
      ),
    ]),
  ),
  triggers: [
    {
      id: "lineFull",
      // The def name matches every pattern line of every player
      on: { type: "moved", to: "patternLine" },
      when: "lineFull",
      flow: step("score", "scoreLine"),
    },
  ],
} as const satisfies GameSpec;
// #endregion spec

type Types = TypesFor<
  typeof spec,
  { vars: { scored: Record<string, number> }; entities: { tile: object } }
>;

/** The line at index i holds i + 1 tiles. */
const size = (index: number) => index + 1;

// #region impl
export const impl = {
  setup(tx) {
    for (let i = 0; i < 16; i++) tx.create("tile", {}, "bag");
    tx.vars = {
      scored: Object.fromEntries(tx.state.players.map((p) => [p, 0])),
    };
  },
  // Runs once at init, so the factories are fixed for the game
  zoneCounts: { factories: ({ players }) => players.length + 1 },
  conditions: {
    factoriesEmpty: (s) => s.zonesOf("factory").every((f) => !f.items.length),
    // In a trigger, scope.event is the move; its zone carries owner and index
    lineFull: (s, scope) => {
      if (scope.event?.type !== "moved") return false;
      const { to } = scope.event;
      const line = s.zonesOf("patternLine").find((l) => l.id === to)!;
      return line.items.length >= size(line.index!);
    },
  },
  steps: {
    refill(tx) {
      tx.shuffle("bag");
      for (const f of tx.zonesOf("factory")) {
        tx.moveTop("bag", f.id, Math.min(2, tx.state.zones.bag.items.length));
      }
    },
    scoreLine(tx) {
      const event = tx.scope.event!;
      if (event.type !== "moved") return;
      const line = tx.zonesOf("patternLine").find((l) => l.id === event.to)!;
      tx.vars.scored[line.owner!]! += size(line.index!);
      tx.move(line.items, "bag");
    },
  },
  actions: {
    take: {
      // zonesOf lists instances in order, so args can be plain indexes
      enumerate: (s, scope) =>
        s
          .zonesOf("factory")
          .flatMap((f) =>
            f.items.length
              ? s
                  .zonesOf("patternLine", scope.player)
                  .map((l) => ({ factory: f.index!, line: l.index! }))
              : [],
          ),
      validate(s, args: { factory: number; line: number }, scope) {
        if (!s.zonesOf("factory")[args.factory]?.items.length)
          return "Pick a factory with tiles";
        if (!s.zonesOf("patternLine", scope.actor)[args.line])
          return "Pick one of your lines";
        return true;
      },
      execute(tx, args: { factory: number; line: number }) {
        const factory = tx.zonesOf("factory")[args.factory]!;
        const line = tx.zonesOf("patternLine", tx.scope.actor)[args.line]!;
        tx.move(factory.items, line.id);
      },
    },
  },
} satisfies GameImpl<Types>;
// #endregion impl

export const game = defineGame({ spec, impl });
