import {
  State,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import {
  initialState,
  pickAction,
  PLAYER_MARK,
  ticTacToeConfig,
  TicTacToeState,
} from "./config";

export function TicTacToe() {
  const currentStates = useStateMachineCurrentState<TicTacToeState>();
  const { marks, playerTurn, winner } = useStateMachineState<TicTacToeState>();
  const { advance, doAction } = useStateMachineActions<TicTacToeState>();

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">Tic-tac-toe</h1>
      <div>
        <button
          className="border p-4 disabled:bg-gray-400"
          disabled={currentStates.includes("game")}
          onClick={() => advance()}
        >
          Start
        </button>

        <State includes="game">
          <div>Player turn: {playerTurn}</div>
        </State>

        <State includes="end">
          <div>Winner: {Array.isArray(winner) ? winner[0] : winner}</div>
        </State>
      </div>
      <Board
        marks={marks}
        disabled={!currentStates.includes("game")}
        onCellClicked={(index) => {
          if (!currentStates.includes("player")) return;
          doAction(pickAction, index, PLAYER_MARK.player);
          advance();
        }}
        highlightCells={Array.isArray(winner) ? winner[1] : undefined}
      />
    </div>
  );
}

function Board({
  marks,
  onCellClicked,
  disabled,
  highlightCells,
}: {
  marks: TicTacToeState["marks"];
  onCellClicked?: (index: number) => void;
  disabled?: boolean;
  highlightCells?: readonly number[];
}) {
  return (
    <div
      className={clsx(
        "mx-auto grid aspect-square w-xl grid-cols-3 grid-rows-3 rounded-lg p-4",
        {
          "bg-gray-200": disabled,
        },
      )}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Cell ${i + 1}${marks[i] ? `, ${marks[i]}` : ""}`}
          disabled={disabled || marks[i] !== undefined}
          className={clsx("size-full p-2", {
            "border-r-2": [0, 1, 3, 4, 6, 7].includes(i),
            "border-b-2": [0, 1, 2, 3, 4, 5].includes(i),
            "bg-green-400": highlightCells?.includes(i),
          })}
          onClick={() => onCellClicked?.(i)}
        >
          {marks[i] === "x" ? <X /> : marks[i] === "o" ? <O /> : null}
        </button>
      ))}
    </div>
  );
}

function O() {
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="none" stroke="black" strokeWidth="10" />
    </svg>
  );
}

function X() {
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
      <line x1="10" y1="10" x2="90" y2="90" stroke="black" strokeWidth="10" strokeLinecap="round" />
      <line x1="90" y1="10" x2="10" y2="90" stroke="black" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

export default withStateMachineContext(
  TicTacToe,
  ticTacToeConfig,
  initialState,
  { autostart: true },
);
