// High Card: the concept pages' running example. Each round everyone gets a
// card from a hidden deck, plays it face up in turn, and the highest wins
// the round. When the deck can't deal another round, the game ends.
import {
  defaultNodes,
  define,
  entity,
  zone,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

// #region box
// An entity type: cards have a rank
export const card = entity<{ rank: number }>("card");

// Zones hold entities, and say who sees them
export const deck = zone("deck", { holds: card, visibility: "hidden" });
export const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
export const table = zone("table", { holds: card });
export const discard = zone("discard", { holds: card, visibility: "top" });
// #endregion box

// #region vars
// Everything that isn't an entity: plain JSON
export interface Vars {
  score: Record<PlayerId, number>;
  round: number;
  /** This round's plays: rank by player. Public once played. */
  played: Record<PlayerId, number>;
}
// #endregion vars

// #region core
const { rules, action, effect, loop, seq, step, turns, prompt } = define<Vars>({
  zones: [deck, hand, table, discard],
}).withNodes(defaultNodes);
// #endregion core

// #region effect
/** A round was won: the page can show it as it plays back. */
export const roundWon = effect<{ winner: PlayerId; rank: number }>("roundWon", {
  resolve: (tx, { winner }) => void tx.vars.score[winner]!++,
});
// #endregion effect

// #region actions
export const playCard = action("playCard", {
  // The only arg is which card; enumerate lists every legal choice
  enumerate: (s, actor) =>
    s.entities(hand.of(actor)).map((c) => ({ id: c.id })),
  validate: (s, { id }, actor) =>
    s.entity(id).zone === hand.of(actor).id ? true : "That isn't your card",
  execute(tx, { id }, actor) {
    const mine = tx.entities(hand.of(actor)).find((c) => c.id === id)!;
    tx.move(id, table);
    tx.vars.played[actor] = mine.props.rank;
  },
});
// #endregion actions

// #region rules
export const highCard = rules({
  players: [2, 4],
  setup(tx) {
    tx.vars = {
      score: Object.fromEntries(tx.players.map((p) => [p, 0])),
      round: 0,
      played: {},
    };
    for (let rank = 1; rank <= 13; rank++) tx.create(card, { rank }, deck);
    tx.shuffle(deck);
  },
  flow: seq(
    loop(
      { until: (s) => s.count(deck) < s.players.length },
      seq(
        step((tx) => {
          tx.vars.round++;
          tx.vars.played = {};
          for (const p of tx.players) tx.moveTop(deck, hand.of(p));
        }),
        turns({ rounds: 1 }, prompt({ label: "Play your card" }, playCard)),
        step((tx) => {
          const [winner, rank] = Object.entries(tx.vars.played).reduce(
            (best, play) => (play[1] > best[1] ? play : best),
          );
          tx.cause(roundWon, { winner, rank });
          tx.move(
            tx.entities(table).map((c) => c.id),
            discard,
          );
        }),
      ),
    ),
    step((tx) => {
      const top = Math.max(...Object.values(tx.vars.score));
      tx.end({
        winners: tx.players.filter((p) => tx.vars.score[p] === top),
      });
    }),
  ),
});
// #endregion rules
