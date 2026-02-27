import {
  StandardD6,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { ReactNode } from "react";
import PageLayout from "../../components/PageLayout";
import {
  computeScoreSummary,
  initialState,
  SCORE_INDEX,
  ScoreIndex,
  YahtzeeCommand,
  yahtzeeConfig,
  YahtzeeState,
} from "./config";

export function Yahtzee() {
  const { dice, heldDice, roll, score } = useStateMachineState<YahtzeeState>();
  const { canDispatch, dispatch, advance } = useStateMachineActions<
    YahtzeeState,
    YahtzeeCommand
  >();
  const [currentState] = useStateMachineCurrentState();

  const { grandTotal } = computeScoreSummary(score);

  return (
    <PageLayout title="Yahtzee">
      <div className="flex size-full flex-col text-white">
        <PageLayout.SafeInset />
        <div className="p-4">
          <HorizontalScoreSheet
            score={score}
            showHighlights={currentState === "scoreTurn"}
            canClickScore={(index) => canDispatch({ type: "score", index })}
            onScoreClicked={(index) => {
              dispatch({ type: "score", index });
              advance();
            }}
          />
        </div>
        <div className="flex-1">
          {currentState === "gameOver" ? (
            <GameOverPanel grandTotal={grandTotal} onPlayAgain={advance} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4">
              <div>{currentState === "roll" && `Roll ${roll}`}</div>
              <div className="flex items-center gap-4">
                {dice?.map((roll, i) => (
                  <StandardD6
                    key={i}
                    value={roll}
                    className={clsx("size-24", {
                      "rounded-xl outline-4 outline-gray-400": heldDice[i],
                    })}
                    onClick={() => {
                      if (currentState === "roll")
                        dispatch({ type: "toggleHold", index: i });
                    }}
                  />
                )) ?? (
                  <>
                    <StandardD6 value={null} className="size-24" />
                    <StandardD6 value={null} className="size-24" />
                    <StandardD6 value={null} className="size-24" />
                    <StandardD6 value={null} className="size-24" />
                    <StandardD6 value={null} className="size-24" />
                  </>
                )}
              </div>
              <div>
                <button
                  className="min-w-24 cursor-pointer rounded bg-indigo-500 p-3 text-white disabled:cursor-default disabled:bg-indigo-200"
                  disabled={
                    currentState !== "setup" && !canDispatch({ type: "roll" })
                  }
                  onClick={() => {
                    if (currentState === "roll") {
                      dispatch({ type: "roll" });
                    }
                    advance();
                  }}
                >
                  Roll
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function GameOverPanel({
  grandTotal,
  onPlayAgain,
}: {
  grandTotal: number;
  onPlayAgain: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <div className="text-4xl font-bold text-gray-800">Game Over!</div>
        <div className="mt-1 text-white">Final score</div>
      </div>
      <div className="text-7xl font-bold text-amber-500">{grandTotal}</div>
      <button
        className="cursor-pointer rounded bg-indigo-500 px-6 py-3 font-semibold text-white hover:bg-indigo-600"
        onClick={onPlayAgain}
      >
        Play Again
      </button>
    </div>
  );
}

function ScoreBox({
  value,
  highlight = false,
  onClick,
}: {
  value?: number;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={clsx(
        "flex h-6 w-10 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-center font-mono font-semibold text-gray-700",
        {
          "cursor-pointer outline-4 outline-green-300": highlight,
        },
      )}
      onClick={onClick}
    >
      {value ?? ""}
    </div>
  );
}

// --- Horizontal Score Sheet ---

function HorizontalScoreSheet({
  score,
  showHighlights = false,
  canClickScore,
  onScoreClicked,
}: {
  score: YahtzeeState["score"];
  showHighlights?: boolean;
  canClickScore?: (index: ScoreIndex) => boolean;
  onScoreClicked?: (index: ScoreIndex) => void;
}) {
  const { upperSubtotal, upperBonus, upperTotal, lowerTotal, grandTotal } =
    computeScoreSummary(score);

  return (
    <div className="flex flex-col gap-1 text-xs">
      {/* Upper Section */}
      <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
        <HorizontalSectionHeader>Upper</HorizontalSectionHeader>
        <HorizontalScoreCol
          label="Aces"
          hint={<StandardD6 value={1} className="size-4" />}
          value={score[SCORE_INDEX.aces]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.aces)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.aces)}
        />
        <HorizontalScoreCol
          label="Twos"
          hint={<StandardD6 value={2} className="size-4" />}
          value={score[SCORE_INDEX.twos]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.twos)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.twos)}
        />
        <HorizontalScoreCol
          label="Threes"
          hint={<StandardD6 value={3} className="size-4" />}
          value={score[SCORE_INDEX.threes]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.threes)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.threes)}
        />
        <HorizontalScoreCol
          label="Fours"
          hint={<StandardD6 value={4} className="size-4" />}
          value={score[SCORE_INDEX.fours]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.fours)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fours)}
        />
        <HorizontalScoreCol
          label="Fives"
          hint={<StandardD6 value={5} className="size-4" />}
          value={score[SCORE_INDEX.fives]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.fives)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fives)}
        />
        <HorizontalScoreCol
          label="Sixes"
          hint={<StandardD6 value={6} className="size-4" />}
          value={score[SCORE_INDEX.sixes]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.sixes)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.sixes)}
        />
        <HorizontalSummaryCol label="Subtotal" value={upperSubtotal} />
        <HorizontalSummaryCol
          label="Bonus"
          hint="≥63 → +35"
          value={upperBonus}
        />
        <HorizontalSummaryCol label="Total" value={upperTotal} emphasized />
      </div>

      {/* Lower Section */}
      <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
        <HorizontalSectionHeader>Lower</HorizontalSectionHeader>
        <HorizontalScoreCol
          label="3 of a Kind"
          hint="Sum all"
          value={score[SCORE_INDEX.threeOfAKind]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.threeOfAKind)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.threeOfAKind)}
        />
        <HorizontalScoreCol
          label="4 of a Kind"
          hint="Sum all"
          value={score[SCORE_INDEX.fourOfAKind]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.fourOfAKind)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fourOfAKind)}
        />
        <HorizontalScoreCol
          label="Full House"
          hint="25 pts"
          value={score[SCORE_INDEX.fullHouse]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.fullHouse)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fullHouse)}
        />
        <HorizontalScoreCol
          label="Sm. Str."
          hint="30 pts"
          value={score[SCORE_INDEX.smallStraight]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.smallStraight)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.smallStraight)}
        />
        <HorizontalScoreCol
          label="Lg. Str."
          hint="40 pts"
          value={score[SCORE_INDEX.largeStraight]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.largeStraight)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.largeStraight)}
        />
        <HorizontalScoreCol
          label="YAHTZEE"
          hint="50 pts"
          value={score[SCORE_INDEX.YAHTZEE]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.YAHTZEE)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.YAHTZEE)}
        />
        <HorizontalScoreCol
          label="Chance"
          hint="Sum all"
          value={score[SCORE_INDEX.chance]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.chance)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.chance)}
        />
        <HorizontalScoreCol
          label="YZ Bonus"
          hint="100 ea."
          value={score[SCORE_INDEX.yahtzeeBonuses]}
        />
        <HorizontalSummaryCol label="Total" value={lowerTotal} />
        <HorizontalGrandTotalCol value={grandTotal} />
      </div>
    </div>
  );
}

function HorizontalSectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-14 shrink-0 items-center justify-center bg-amber-400 text-center font-bold tracking-wide text-amber-900">
      {children}
    </div>
  );
}

function HorizontalScoreCol({
  label,
  hint,
  value,
  showHighlight,
  disabled = false,
  onScoreClicked,
}: {
  label: string;
  hint?: ReactNode;
  value?: number;
  showHighlight?: boolean;
  disabled?: boolean;
  onScoreClicked?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 border-l border-gray-100 px-1 py-1.5">
      <div className="text-center leading-tight font-medium text-gray-800">
        {label}
      </div>
      <div className="flex h-5 items-center justify-center leading-tight text-gray-400">
        {hint}
      </div>
      <ScoreBox
        value={value}
        highlight={showHighlight && value === undefined && !disabled}
        onClick={!disabled ? onScoreClicked : undefined}
      />
    </div>
  );
}

function HorizontalSummaryCol({
  label,
  hint,
  value,
  emphasized = false,
}: {
  label: string;
  hint?: string;
  value?: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 border-l px-1 py-1.5",
        emphasized
          ? "border-amber-200 bg-amber-100"
          : "border-gray-200 bg-amber-50",
      )}
    >
      <div className="text-center leading-tight font-semibold text-amber-900">
        {label}
      </div>
      <div className="flex h-5 items-center leading-tight text-amber-600">
        {hint ?? ""}
      </div>
      <ScoreBox value={value} />
    </div>
  );
}

function HorizontalGrandTotalCol({ value }: { value: number }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-amber-600 px-1 py-1.5">
      <div className="text-center leading-tight font-bold text-white">
        Grand Total
      </div>
      <ScoreBox value={value} />
    </div>
  );
}

export default withStateMachineContext(Yahtzee, yahtzeeConfig, initialState, {
  autostart: true,
});
