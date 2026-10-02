import type {
  GameImpl,
  PlayerId,
  TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

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

export interface Vars {
  marks: Cell[];
  /** The winning player; null while playing or after a tie. */
  winner: PlayerId | null;
  /** The last game ended with a full board and no line. */
  tie: boolean;
  /** The winning line's cells. */
  line: number[] | null;
  wins: Record<PlayerId, number>;
  ties: number;
}

export type Types = TypesFor<typeof spec, { vars: Vars }>;

export type PlaceArgs = { index: number };

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

export const impl = {
  setup(tx) {
    tx.vars = {
      marks: Array<Cell>(9).fill(null),
      winner: null,
      tie: false,
      line: null,
      wins: Object.fromEntries(tx.state.players.map((p) => [p, 0])),
      ties: 0,
    };
  },
  // #region conditions
  conditions: {
    boardDecided: (s) =>
      winningLine(s.vars.marks) !== null || isFull(s.vars.marks),
  },
  // #endregion conditions
  steps: {
    clearBoard(tx) {
      tx.vars.marks = Array<Cell>(9).fill(null);
      tx.vars.winner = null;
      tx.vars.tie = false;
      tx.vars.line = null;
    },
    recordResult(tx) {
      const line = winningLine(tx.vars.marks);
      if (line) {
        const mark = tx.vars.marks[line[0]!];
        const winner = tx.state.players.find(
          (p) => markOf(tx.state.players, p) === mark,
        )!;
        tx.vars.winner = winner;
        tx.vars.line = [...line];
        tx.vars.wins[winner] = (tx.vars.wins[winner] ?? 0) + 1;
      } else {
        tx.vars.tie = true;
        tx.vars.ties++;
      }
    },
  },
  // #region actions
  actions: {
    placeMark: {
      enumerate: (s): PlaceArgs[] =>
        s.vars.marks.flatMap((m, index) => (m === null ? [{ index }] : [])),
      validate: (s, args: PlaceArgs) =>
        Number.isInteger(args.index) && s.vars.marks[args.index] === null
          ? true
          : "Pick an empty cell",
      execute(tx, args: PlaceArgs) {
        tx.vars.marks[args.index] = markOf(tx.state.players, tx.scope.actor!);
      },
    },
  },
  // #endregion actions
} satisfies GameImpl<Types>;
