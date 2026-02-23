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
          disabled={currentStates[1] === "game"}
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
        disabled={currentStates[1] !== "game"}
        onCellClicked={(index) => {
          if (currentStates[0] !== "player") return;
          doAction(pickAction, index, "x");
          advance();
        }}
        highlightCells={winner?.[1]}
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
  highlightCells?: [
    0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  ];
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
        <div
          key={i}
          className={clsx("size-full p-2", {
            "border-r-2": [0, 1, 3, 4, 6, 7].includes(i),
            "border-b-2": [0, 1, 2, 3, 4, 5].includes(i),
            "bg-green-400": highlightCells?.includes(i),
          })}
          onClick={() => onCellClicked?.(i)}
        >
          {marks[i] === "x" ? <X /> : marks[i] === "o" ? <O /> : null}
        </div>
      ))}
    </div>
  );
}

function O() {
  return <div className="size-full rounded-full bg-black" />;
}

function X() {
  return (
    <div className="flex size-full items-center justify-center">
      <div className="h-full w-px rotate-45 border-r-8" />
      <div className="h-full w-px -rotate-45 border-r-8" />
    </div>
  );
}

export default withStateMachineContext(
  TicTacToe,
  ticTacToeConfig,
  initialState,
  { autostart: true },
);
