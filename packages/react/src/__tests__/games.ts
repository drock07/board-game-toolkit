// Fixture games for the host and devtools tests.
import {
  defaultNodes,
  define,
  entity,
  zone,
} from "@drock07/board-game-toolkit-engine";

// Players take turns drawing from a hidden deck into hands only they see;
// after each round the first seat moves on. A draw whispers `drew` to its
// drawer.
export interface Card {
  n: number;
}
export const card = entity<Card>("card");
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});

const draws = define<{ rounds: number }>({ zones: [deck, hand] }).withNodes(
  defaultNodes,
);
export const drew = draws.effect<{ by: string; count: number }>("drew", {
  to: (d) => [d.by],
});

export const drawGame = draws.rules({
  players: 2,
  setup: (tx) => {
    tx.vars = { rounds: 0 };
    for (let n = 0; n < 20; n++) tx.create(card, { n }, deck);
  },
  flow: draws.loop(
    {},
    draws.seq(
      draws.turns(
        { rounds: 1 },
        draws.prompt(
          { label: "Draw" },
          draws.action("draw", {
            execute: (tx, actor) => {
              tx.moveTop(deck, hand.of(actor));
              tx.cause(drew, { by: actor, count: 1 });
            },
          }),
          draws.action("drawTwo", {
            execute: (tx, actor) => {
              tx.moveTop(deck, hand.of(actor), 2);
              tx.cause(drew, { by: actor, count: 2 });
            },
          }),
        ),
      ),
      draws.prompt(
        { label: "Next round" },
        draws.action("next", { execute: (tx) => void tx.vars.rounds++ }),
      ),
    ),
  ),
});

// Everyone plays a turn at once, each on their own fiber
const atOnce = define<{ done: number }>().withNodes(defaultNodes);
export const atOnceGame = atOnce.rules({
  players: [2, 3],
  setup: (tx) => void (tx.vars = { done: 0 }),
  flow: atOnce.seq(
    atOnce.simultaneous(
      atOnce.turn(
        { label: "Your turn", limits: { tap: 2 } },
        atOnce.action("tap", { execute: () => {} }),
        atOnce.action("stop", {
          execute: (tx) => {
            tx.vars.done++;
            return "end";
          },
        }),
      ),
    ),
    atOnce.step((tx) => tx.end()),
  ),
});
