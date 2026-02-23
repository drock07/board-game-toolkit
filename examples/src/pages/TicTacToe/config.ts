import { ActionFn, StateMachineConfig } from "@drock07/board-game-toolkit-core";

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

export interface TicTacToeState {
  marks: ("x" | "o" | undefined)[];
  playerTurn: "player" | "computer" | null;
  winner: ["player" | "computer", WinningPosition] | "tie" | null;
}

export const initialState: TicTacToeState = {
  marks: [],
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
      initial: "whoStarts",
      onEnter: (state) => {
        return {
          ...state,
          marks: [],
          playerTurn: Math.random() > 0.5 ? "player" : "computer",
          winner: null,
        };
      },
      states: {
        whoStarts: {
          autoadvance: true,
          onEnter: (state) => {
            console.log(state.playerTurn, "first");
            return state;
          },
          getNext: (state) => state.playerTurn,
        },
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
            let emptyIndex = -1;
            for (let i = 0; i < 9; i++) {
              const element = state.marks[i];
              if (element === undefined) {
                emptyIndex = i;
                break;
              }
            }
            if (emptyIndex < 0) return state;
            return pickAction(state, emptyIndex, "o");
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

function checkForWin(
  marks: ("x" | "o" | undefined)[],
): ["player" | "computer", WinningPosition] | "tie" | undefined {
  const winningCombo = winningPositions.find((pos) => {
    return (
      pos.every((i) => marks[i] === "x") || pos.every((i) => marks[i] === "o")
    );
  });

  if (!winningCombo) return;

  return [
    marks[winningCombo[0]]! === "x" ? "player" : "computer",
    winningCombo,
  ];
}

/**
 * Actions
 */

export const pickAction: ActionFn<
  TicTacToeState,
  [index: number, mark: "x" | "o"]
> = (state, index, mark) => {
  if (index < 0 || index > 8 || state.marks[index] !== undefined) return state;
  const newMarks = [...state.marks];
  newMarks[index] = mark;
  return {
    ...state,
    marks: newMarks,
  };
};
