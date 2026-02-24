import {
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
  DieRoll,
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
    <PageLayout title="Yahtzee" className="flex size-full">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {currentState === "gameOver" ? (
          <GameOverPanel grandTotal={grandTotal} onPlayAgain={advance} />
        ) : (
          <>
            <div>{currentState === "roll" && `Roll ${roll}`}</div>
            <div className="flex items-center gap-4">
              {dice?.map((roll, i) => (
                <Die
                  key={i}
                  pips={roll}
                  outline={heldDice[i]}
                  onClick={() => {
                    if (currentState === "roll")
                      dispatch({ type: "toggleHold", index: i });
                  }}
                />
              )) ?? (
                <>
                  <Die />
                  <Die />
                  <Die />
                  <Die />
                  <Die />
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
          </>
        )}
      </div>

      <div className="p-4">
        <ScoreSheet
          score={score}
          showHighlights={currentState === "scoreTurn"}
          canClickScore={(index) => canDispatch({ type: "score", index })}
          onScoreClicked={(index) => {
            dispatch({ type: "score", index });
            advance();
          }}
        />
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
        <div className="mt-1 text-gray-500">Final score</div>
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

function Die({
  pips,
  size = "size-16",
  onClick,
  outline = false,
}: {
  pips?: DieRoll;
  size?: string;
  onClick?: () => void;
  outline?: boolean;
}) {
  if (!pips) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center rounded-[20%] border bg-white text-3xl",
          size,
        )}
      >
        ?
      </div>
    );
  }
  return (
    <svg
      viewBox="0 0 30 30"
      className={clsx("cursor-pointer rounded-[20%] border bg-white", size, {
        "outline-4 outline-gray-300": outline,
      })}
      onClick={onClick}
    >
      {[1, 3, 5].includes(pips) && (
        <circle cx={15} cy={15} r="2.5" fill="black" />
      )}
      {[4, 5, 6].includes(pips) && (
        <circle cx={8} cy={8} r="2.5" fill="black" />
      )}
      {[2, 3, 4, 5, 6].includes(pips) && (
        <circle cx={22} cy={8} r="2.5" fill="black" />
      )}
      {[2, 3, 4, 5, 6].includes(pips) && (
        <circle cx={8} cy={22} r="2.5" fill="black" />
      )}
      {[4, 5, 6].includes(pips) && (
        <circle cx={22} cy={22} r="2.5" fill="black" />
      )}
      {pips === 6 && (
        <>
          <circle cx={8} cy={15} r="2.5" fill="black" />
          <circle cx={22} cy={15} r="2.5" fill="black" />
        </>
      )}
    </svg>
  );
}

function ScoreSheet({
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
    <div className="w-52 overflow-hidden rounded-lg border border-gray-300 bg-white text-xs shadow-sm">
      <SectionHeader>Upper Section</SectionHeader>
      <ScoreRow
        value={score[SCORE_INDEX.aces]}
        label="Aces"
        hint={
          <>
            Count all <Die pips={1} size="size-4" />
          </>
        }
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.aces)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.aces)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.twos]}
        label="Twos"
        hint={
          <>
            Count all <Die pips={2} size="size-4" />
          </>
        }
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.twos)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.twos)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.threes]}
        label="Threes"
        hint={
          <>
            Count all <Die pips={3} size="size-4" />
          </>
        }
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.threes)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.threes)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.fours]}
        label="Fours"
        hint={
          <>
            Count all <Die pips={4} size="size-4" />
          </>
        }
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.fours)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fours)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.fives]}
        label="Fives"
        hint={
          <>
            Count all <Die pips={5} size="size-4" />
          </>
        }
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.fives)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fives)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.sixes]}
        label="Sixes"
        hint={
          <>
            Count all <Die pips={6} size="size-4" />
          </>
        }
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.sixes)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.sixes)}
      />
      <SubtotalRow label="Subtotal" value={upperSubtotal} />
      <BonusRow label="Bonus" note="≥63 → +35" value={upperBonus} />
      <SubtotalRow label="Upper Total" value={upperTotal} />

      <SectionHeader>Lower Section</SectionHeader>
      <ScoreRow
        value={score[SCORE_INDEX.threeOfAKind]}
        label="3 of a Kind"
        hint="Sum all dice"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.threeOfAKind)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.threeOfAKind)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.fourOfAKind]}
        label="4 of a Kind"
        hint="Sum all dice"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.fourOfAKind)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fourOfAKind)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.fullHouse]}
        label="Full House"
        hint="25 pts"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.fullHouse)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.fullHouse)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.smallStraight]}
        label="Sm. Straight"
        hint="30 pts"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.smallStraight)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.smallStraight)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.largeStraight]}
        label="Lg. Straight"
        hint="40 pts"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.largeStraight)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.largeStraight)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.YAHTZEE]}
        label="YAHTZEE"
        hint="50 pts"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.YAHTZEE)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.YAHTZEE)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.chance]}
        label="Chance"
        hint="Sum all dice"
        showHighlight={showHighlights}
        disabled={!canClickScore?.(SCORE_INDEX.chance)}
        onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.chance)}
      />
      <ScoreRow
        value={score[SCORE_INDEX.yahtzeeBonuses]}
        label="Yahtzee Bonus"
        hint="100 pts ea."
      />
      <SubtotalRow label="Lower Total" value={lowerTotal} />

      <div className="flex items-center justify-between bg-amber-600 px-2 py-1.5 font-bold text-white">
        <span>Grand Total</span>
        <ScoreBox value={grandTotal} />
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="bg-amber-400 px-2 py-1 text-center font-bold tracking-wide text-amber-900">
      {children}
    </div>
  );
}

function ScoreRow({
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
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-2 py-1 odd:bg-white even:bg-gray-50">
      <div className="min-w-0">
        <div className="font-medium text-gray-800">{label}</div>
        {hint && (
          <div className="flex items-center gap-2 text-gray-400">{hint}</div>
        )}
      </div>
      <ScoreBox
        value={value}
        highlight={showHighlight && value === undefined && !disabled}
        onClick={!disabled ? onScoreClicked : undefined}
      />
    </div>
  );
}

function SubtotalRow({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50 px-2 py-1">
      <span className="font-semibold text-amber-900">{label}</span>
      <ScoreBox value={value} />
    </div>
  );
}

function BonusRow({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50 px-2 py-1">
      <div>
        <div className="font-semibold text-amber-900">{label}</div>
        <div className="text-amber-600">{note}</div>
      </div>
      <ScoreBox value={value} />
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

export default withStateMachineContext(Yahtzee, yahtzeeConfig, initialState, {
  autostart: true,
});
