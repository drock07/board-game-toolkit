import { ActionFn, StateMachineConfig } from "@drock07/board-game-toolkit-core";

type Mark = "x" | "o";

const winningPositions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;
type WinningPosition = (typeof winningPositions)[number];

export const PLAYER_MARK = {
  player: "x",
  computer: "o",
} as const;

export interface TicTacToeState {
  marks: (Mark | undefined)[];
  playerTurn: "player" | "computer" | null;
  winner: ["player" | "computer", WinningPosition] | "tie" | null;
}

export const initialState: TicTacToeState = {
  marks: Array(9).fill(undefined),
  playerTurn: null,
  winner: null,
};

export const ticTacToeConfig: StateMachineConfig<TicTacToeState> = {
  id: "tictactoe",
  initial: "start",
  states: {
    start: {
      getNext: () => "game",
    },
    game: {
      id: "game",
      initial: (state) => state.playerTurn!,
      onEnter: (state) => {
        return {
          ...state,
          marks: Array(9).fill(undefined),
          playerTurn: Math.random() > 0.5 ? "player" : "computer",
          winner: null,
        };
      },
      states: {
        player: {
          onExit: (state) => ({
            ...state,
            playerTurn: "computer",
          }),
          getNext: () => "evaluate",
        },
        computer: {
          autoadvance: true,
          onEnter: (state) => {
            const bestIndex = findBestMove(state.marks, PLAYER_MARK.computer);
            if (bestIndex < 0) return state;
            return pickAction(state, bestIndex, PLAYER_MARK.computer);
          },
          onExit: (state) => ({
            ...state,
            playerTurn: "player",
          }),
          getNext: () => "evaluate",
        },
        evaluate: {
          autoadvance: true,
          onEnter: (state) => {
            const result = checkForWin(state.marks);
            if (!result) return state;
            return {
              ...state,
              winner: result,
            };
          },
          getNext: (state) => {
            if (!state.winner) return state.playerTurn;
            return null;
          },
        },
      },
      getNext: () => "end",
    },
    end: {
      getNext: () => "game",
    },
  },
};

function findBestMove(marks: (Mark | undefined)[], mark: Mark): number {
  let bestScore = -Infinity;
  let bestIndex = -1;

  for (let i = 0; i < 9; i++) {
    if (marks[i] !== undefined) continue;
    const next = [...marks];
    next[i] = mark;
    const score = minimax(next, mark === "x" ? "o" : "x", mark);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function minimax(
  marks: (Mark | undefined)[],
  currentMark: Mark,
  maximizingMark: Mark,
): number {
  const winner = winningPositions.find(
    (pos) =>
      pos.every((i) => marks[i] === "x") || pos.every((i) => marks[i] === "o"),
  );

  if (winner) {
    return marks[winner[0]] === maximizingMark ? 1 : -1;
  }
  if (marks.every((m) => m !== undefined)) return 0;

  const isMaximizing = currentMark === maximizingMark;
  let best = isMaximizing ? -Infinity : Infinity;

  for (let i = 0; i < 9; i++) {
    if (marks[i] !== undefined) continue;
    const next = [...marks];
    next[i] = currentMark;
    const score = minimax(
      next,
      currentMark === "x" ? "o" : "x",
      maximizingMark,
    );
    best = isMaximizing ? Math.max(best, score) : Math.min(best, score);
  }

  return best;
}

function checkForWin(
  marks: (Mark | undefined)[],
): ["player" | "computer", WinningPosition] | "tie" | undefined {
  const winningCombo = winningPositions.find((pos) => {
    return (
      pos.every((i) => marks[i] === "x") || pos.every((i) => marks[i] === "o")
    );
  });

  if (!winningCombo)
    return marks.every((m) => m !== undefined) ? "tie" : undefined;

  return [
    marks[winningCombo[0]]! === PLAYER_MARK.player ? "player" : "computer",
    winningCombo,
  ];
}

/**
 * Actions
 */

export const pickAction: ActionFn<
  TicTacToeState,
  [index: number, mark: Mark]
> = (state, index, mark) => {
  if (index < 0 || index > 8 || state.marks[index] !== undefined) return state;
  const newMarks = [...state.marks];
  newMarks[index] = mark;
  return {
    ...state,
    marks: newMarks,
  };
};
