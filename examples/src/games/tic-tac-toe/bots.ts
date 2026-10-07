import type { GameInput } from "@drock07/board-game-toolkit-engine";
import type { SyncBot } from "@drock07/board-game-toolkit-engine/testing";
import {
  isFull,
  markOf,
  winningLine,
  type Cell,
  type Mark,
  type ticTacToe,
  type Vars,
} from "./game";

const other = (m: Mark): Mark => (m === "x" ? "o" : "x");

const memo = new Map<string, number>();

/** The board's value for `me`: 1 if I win, -1 if I lose, 0 for a draw, with best play. */
function minimax(marks: Cell[], toMove: Mark, me: Mark): number {
  const key = marks.map((m) => m ?? "-").join("") + toMove + me;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const value = search(marks, toMove, me);
  memo.set(key, value);
  return value;
}

function search(marks: Cell[], toMove: Mark, me: Mark): number {
  const line = winningLine(marks);
  if (line) return marks[line[0]!] === me ? 1 : -1;
  if (isFull(marks)) return 0;
  const scores: number[] = [];
  marks.forEach((cell, i) => {
    if (cell !== null) return;
    marks[i] = toMove;
    scores.push(minimax(marks, other(toMove), me));
    marks[i] = null;
  });
  return toMove === me ? Math.max(...scores) : Math.min(...scores);
}

/**
 * Plays perfectly: scores each legal placement with minimax and takes the
 * best, breaking ties with its own RNG. Plays again when asked.
 */
// #region bot
export const minimaxBot: SyncBot<Vars, GameInput<typeof ticTacToe>> = (
  legal,
  { view, player, random },
) => {
  const places = legal.filter((i) => i.action === "placeMark");
  if (!places.length) return random.pick(legal);
  const me = markOf(view.players, player);
  let best = -Infinity;
  let choices: typeof places = [];
  for (const input of places) {
    const marks = [...view.vars.marks];
    marks[input.args.index] = me;
    const score = minimax(marks, other(me), me);
    if (score > best) {
      best = score;
      choices = [input];
    } else if (score === best) {
      choices.push(input);
    }
  }
  return random.pick(choices);
};
// #endregion bot
