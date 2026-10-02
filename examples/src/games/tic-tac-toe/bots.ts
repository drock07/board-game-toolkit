import type { Bot } from "@drock07/board-game-toolkit-engine";
import {
  isFull,
  markOf,
  winningLine,
  type Cell,
  type Mark,
  type Types,
} from "./impl";

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
 * best, breaking ties with its own RNG. Continues past the end-of-game pause.
 */
export const minimaxBot: Bot<Types> = (
  state,
  prompt,
  { player, legal, random },
) => {
  if (prompt.node !== "place") return random.pick(legal);
  const me = markOf(state.players, player);
  let best = -Infinity;
  let choices: typeof legal = [];
  for (const input of legal) {
    if (!("args" in input)) continue;
    const { index } = input.args as { index: number };
    const marks = [...state.vars.marks];
    marks[index] = me;
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
