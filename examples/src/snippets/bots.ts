// The Bots guide's sample: a Roll Five bot that reads its view, including
// what the turn shows, and picks from its legal inputs.
import { turnNode, type GameInput } from "@drock07/board-game-toolkit-engine";
import type { SyncBot } from "@drock07/board-game-toolkit-engine/testing";
import { roll, score, type rollFive } from "../games/roll-five";
import { MAX_ROLLS, scoreFor, type Vars } from "../games/roll-five/game";

// #region greedy
/**
 * Scores the best category for its dice, rolling again first if the best is
 * worth less than 20 and it has a roll left.
 */
export const greedyBot: SyncBot<Vars, GameInput<typeof rollFive>> = (
  legal,
  { view, random },
) => {
  const scores = legal.filter(score.is);
  const again = legal.find(roll.is);
  // The first answer of a turn must be a roll; between games, "again"
  if (!scores.length) return again ?? random.pick(legal);

  const value = (i: (typeof scores)[number]) =>
    scoreFor(i.args.category, view.vars.dice);
  const best = scores.reduce((a, b) => (value(b) > value(a) ? b : a));
  // The turn counts its rolls; the bot reads the count from its view
  const rolls = turnNode.shown(view)?.counts.roll ?? 0;
  return value(best) < 20 && rolls < MAX_ROLLS && again ? again : best;
};
// #endregion greedy
