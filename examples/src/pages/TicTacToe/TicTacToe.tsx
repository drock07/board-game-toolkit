import {
  State,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import PageLayout from "../../components/PageLayout";
import {
  initialState,
  TicTacToeCommand,
  ticTacToeConfig,
  TicTacToeState,
} from "./config";

export function TicTacToe() {
  const currentStates = useStateMachineCurrentState<TicTacToeState>();
  const { marks, winner } = useStateMachineState<TicTacToeState>();
  const { advance, dispatch } = useStateMachineActions<
    TicTacToeState,
    TicTacToeCommand
  >();

  const isPlaying = currentStates.includes("game");
  const showOverlay = !isPlaying;

  return (
    <PageLayout title="Tic-Tac-Toe">
      <div className="flex h-full flex-col items-center gap-4 px-4 pb-12">
        <PageLayout.SafeInset />

        <div className="relative aspect-square min-h-0 max-w-full flex-1">
          <div className={clsx({ "blur-sm": showOverlay })}>
            <Board
              marks={marks}
              disabled={!isPlaying}
              onCellClicked={(index) => {
                if (!currentStates.includes("player")) return;
                dispatch({ type: "placeMark", index });
                advance();
              }}
              highlightCells={Array.isArray(winner) ? winner[1] : undefined}
            />
          </div>

          {showOverlay && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <State includes="end">
                <p className="text-2xl font-bold text-white">
                  {winner === "tie"
                    ? "It's a tie!"
                    : Array.isArray(winner) && winner[0] === "player"
                      ? "You win!"
                      : "Computer wins!"}
                </p>
              </State>

              <button
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-6 py-3 text-lg font-medium shadow-sm hover:bg-gray-50"
                onClick={() => advance()}
              >
                {currentStates.includes("end") ? "Play again" : "Start"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
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
    <div className="grid aspect-square grid-cols-3 grid-rows-3">
      {Array.from({ length: 9 }).map((_, i) => {
        const isInteractive = !disabled && marks[i] === undefined;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Cell ${i + 1}${marks[i] ? `, ${marks[i]}` : ""}`}
            disabled={disabled || marks[i] !== undefined}
            className={clsx(
              "flex items-center justify-center p-3",
              "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-blue-500",
              {
                "border-r-6 border-white": i % 3 !== 2,
                "border-b-6 border-white": i < 6,
              },
            )}
            onClick={() => onCellClicked?.(i)}
          >
            <div
              className={clsx("size-full rounded-lg", {
                "bg-green-100/20": highlightCells?.includes(i),
                "cursor-pointer bg-white/10 hover:bg-white/20": isInteractive,
                "cursor-default": !isInteractive,
              })}
            >
              {marks[i] === "x" ? <X /> : marks[i] === "o" ? <O /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function O() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="size-full text-red-500"
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
      />
    </svg>
  );
}

function X() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="size-full text-blue-600"
      aria-hidden="true"
    >
      <line
        x1="10"
        y1="10"
        x2="90"
        y2="90"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <line
        x1="90"
        y1="10"
        x2="10"
        y2="90"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default withStateMachineContext(
  TicTacToe,
  ticTacToeConfig,
  initialState,
  { autostart: true },
);
