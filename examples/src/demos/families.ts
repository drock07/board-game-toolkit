// Zone families: a zone may come per player, in a counted set, or both.
// Here each player has three piles and moves tokens between them; the
// shared pool is a "top" pile, so only its top token shows.
import {
  defaultNodes,
  define,
  entity,
  zone,
} from "@drock07/board-game-toolkit-engine";

const token = entity<{ n: number }>("token");

// #region zones
const pool = zone("pool", { holds: token, visibility: "top" });
const piles = zone("pile", { holds: token, perPlayer: true, count: 3 });
// #endregion zones

const { rules, action, loop, prompt } = define<{ moves: number }>({
  zones: [pool, piles],
}).withNodes(defaultNodes);

// #region game
const take = action("take", {
  enumerate: () => [0, 1, 2].map((pile) => ({ pile })),
  validate: (s) => (s.count(pool) ? true : "The pool is empty"),
  execute: (tx, { pile }, actor) => {
    tx.moveTop(pool, piles.of(actor, pile));
    tx.vars.moves++;
  },
});
const shift = action("shift", {
  enumerate: () => [0, 1, 2].map((from) => ({ from })),
  validate: (s, { from }, actor) =>
    s.count(piles.of(actor, from)) ? true : "That pile is empty",
  execute: (tx, { from }, actor) => {
    // To the bottom of the next pile along
    tx.moveTop(piles.of(actor, from), piles.of(actor, (from + 1) % 3), 1, {
      at: "bottom",
    });
    tx.vars.moves++;
  },
});

export const game = rules({
  players: 2,
  setup: (tx) => {
    tx.vars = { moves: 0 };
    for (let n = 1; n <= 12; n++) tx.create(token, { n }, pool);
  },
  flow: loop({}, prompt({ label: "Take or shift" }, take, shift)),
});
// #endregion game
