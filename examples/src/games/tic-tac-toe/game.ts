import {
  defaultNodes,
  define,
  type PlayerId,
} from "@drock07/board-game-toolkit-engine";

export type Mark = "x" | "o";
export type Cell = Mark | null;

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

// #region types
// The board is nine cells in vars, so there are no zones
export interface Vars {
  marks: Cell[];
  /** Who moves first this game, drawn at random. */
  starter: PlayerId;
  /** The winning player; null while playing or after a tie. */
  winner: PlayerId | null;
  /** The last game ended with a full board and no line. */
  tie: boolean;
  /** The winning line's cells. */
  line: number[] | null;
  wins: Record<PlayerId, number>;
  ties: number;
}
// #endregion types

/** The first player in seat order plays x. */
export function markOf(players: readonly PlayerId[], player: PlayerId): Mark {
  return players.indexOf(player) === 0 ? "x" : "o";
}

/** The winning line, if any. */
export function winningLine(marks: readonly Cell[]): readonly number[] | null {
  return (
    LINES.find(
      ([a, b, c]) => marks[a] && marks[a] === marks[b] && marks[a] === marks[c],
    ) ?? null
  );
}

export const isFull = (marks: readonly Cell[]) =>
  marks.every((m) => m !== null);

// #region core
const { rules, action, loop, seq, step, turns, prompt } =
  define<Vars>().withNodes(defaultNodes);
// #endregion core

// #region actions
export const placeMark = action("placeMark", {
  enumerate: (s) =>
    s.vars.marks.flatMap((m, index) => (m === null ? [{ index }] : [])),
  validate: (s, { index }) =>
    Number.isInteger(index) && s.vars.marks[index] === null
      ? true
      : "Pick an empty cell",
  execute(tx, { index }, actor) {
    tx.vars.marks[index] = markOf(tx.players, actor);
  },
});

export const again = action("again", { execute: () => {} });
// #endregion actions

// #region rules
export const ticTacToe = rules({
  players: 2,
  setup(tx) {
    tx.vars = {
      marks: Array<Cell>(9).fill(null),
      starter: tx.players[0]!,
      winner: null,
      tie: false,
      line: null,
      wins: Object.fromEntries(tx.players.map((p) => [p, 0])),
      ties: 0,
    };
  },
  // Games repeat forever: clear, take turns until decided, record, wait
  flow: loop(
    {},
    seq(
      step((tx) => {
        tx.vars.marks = Array<Cell>(9).fill(null);
        tx.vars.starter = tx.random.pick(tx.players);
        tx.vars.winner = null;
        tx.vars.tie = false;
        tx.vars.line = null;
      }),
      turns(
        {
          from: (s) => s.vars.starter,
          until: (s) =>
            winningLine(s.vars.marks) !== null || isFull(s.vars.marks),
        },
        prompt({ label: "Place a mark" }, placeMark),
      ),
      step((tx) => {
        const line = winningLine(tx.vars.marks);
        if (!line) {
          tx.vars.tie = true;
          tx.vars.ties++;
          return;
        }
        const mark = tx.vars.marks[line[0]!];
        const winner = tx.players.find((p) => markOf(tx.players, p) === mark)!;
        tx.vars.winner = winner;
        tx.vars.line = [...line];
        tx.vars.wins[winner] = (tx.vars.wins[winner] ?? 0) + 1;
      }),
      prompt({ label: "Play again" }, again),
    ),
  ),
});
// #endregion rules
