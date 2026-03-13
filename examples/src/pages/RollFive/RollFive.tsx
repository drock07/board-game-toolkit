import {
  StandardD6,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { ReactNode } from "react";
import PageLayout, {
  GlassButton,
  GlassContainer,
} from "../../components/PageLayout";
import {
  computeScoreSummary,
  initialState,
  SCORE_INDEX,
  ScoreIndex,
  RollFiveCommand,
  rollFiveConfig,
  RollFiveState,
} from "./config";

export function RollFive() {
  const { dice, heldDice, roll, score } =
    useStateMachineState<RollFiveState>();
  const { canDispatch, dispatch, advance } = useStateMachineActions<
    RollFiveState,
    RollFiveCommand
  >();
  const [currentState] = useStateMachineCurrentState();

  const { grandTotal } = computeScoreSummary(score);

  return (
    <PageLayout
      title="Roll Five"
      topRight={
        <GlassContainer className="text-lg font-semibold">
          Score: {grandTotal}
        </GlassContainer>
      }
      bottomCenter={
        <>
          {currentState === "setup" && (
            <GlassButton onClick={() => advance()}>Roll</GlassButton>
          )}
          {currentState === "roll" && (
            <GlassButton
              disabled={!canDispatch({ type: "roll" })}
              onClick={() => {
                dispatch({ type: "roll" });
                advance();
              }}
            >
              Roll
            </GlassButton>
          )}
          {currentState === "gameOver" && (
            <GlassButton onClick={() => advance()}>Play Again</GlassButton>
          )}
        </>
      }
    >
      <div className="relative flex size-full flex-col text-white">
        <PageLayout.SafeInset />
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="p-4">
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl ring-inset">
              <HorizontalScoreSheet
                score={score}
                showHighlights={currentState === "scoreTurn"}
                canClickScore={(index) =>
                  canDispatch({ type: "score", index })
                }
                onScoreClicked={(index) => {
                  dispatch({ type: "score", index });
                  advance();
                }}
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            {currentState === "gameOver" ? (
              <GameOverPanel grandTotal={grandTotal} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="h-6">{currentState === "roll" && `Roll ${roll}`}</div>
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
              </div>
            )}
          </div>
          <PageLayout.SafeInset />
        </div>
      </div>
    </PageLayout>
  );
}

function GameOverPanel({ grandTotal }: { grandTotal: number }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <div className="text-4xl font-bold text-white/80">Game Over!</div>
        <div className="mt-1 text-white/60">Final score</div>
      </div>
      <div className="text-7xl font-bold text-amber-400">{grandTotal}</div>
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
        "flex h-6 w-10 shrink-0 items-center justify-center rounded border border-dashed border-white/20 text-center font-mono font-semibold text-white",
        {
          "cursor-pointer outline-4 outline-green-400/60": highlight,
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
  score: RollFiveState["score"];
  showHighlights?: boolean;
  canClickScore?: (index: ScoreIndex) => boolean;
  onScoreClicked?: (index: ScoreIndex) => void;
}) {
  const { upperSubtotal, upperBonus, upperTotal, lowerTotal, grandTotal } =
    computeScoreSummary(score);

  return (
    <div className="flex flex-col gap-px text-xs">
      {/* Upper Section */}
      <div className="flex">
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
      <div className="flex">
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
          label="Roll Five"
          hint="50 pts"
          value={score[SCORE_INDEX.rollFive]}
          showHighlight={showHighlights}
          disabled={!canClickScore?.(SCORE_INDEX.rollFive)}
          onScoreClicked={() => onScoreClicked?.(SCORE_INDEX.rollFive)}
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
          label="R5 Bonus"
          hint="100 ea."
          value={score[SCORE_INDEX.rollFiveBonuses]}
        />
        <HorizontalSummaryCol label="Total" value={lowerTotal} />
        <HorizontalGrandTotalCol value={grandTotal} />
      </div>
    </div>
  );
}

function HorizontalSectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-14 shrink-0 items-center justify-center bg-white/10 text-center font-bold tracking-wide text-amber-300">
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
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 border-l border-white/10 px-1 py-1.5">
      <div className="text-center leading-tight font-medium text-white/80">
        {label}
      </div>
      <div className="flex h-5 items-center justify-center leading-tight text-white/40">
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
          ? "border-amber-400/30 bg-amber-400/10"
          : "border-white/10 bg-white/5",
      )}
    >
      <div className="text-center leading-tight font-semibold text-amber-300">
        {label}
      </div>
      <div className="flex h-5 items-center leading-tight text-amber-400/60">
        {hint ?? ""}
      </div>
      <ScoreBox value={value} />
    </div>
  );
}

function HorizontalGrandTotalCol({ value }: { value: number }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-amber-400/20 px-1 py-1.5">
      <div className="text-center leading-tight font-bold text-amber-300">
        Grand Total
      </div>
      <ScoreBox value={value} />
    </div>
  );
}

export default withStateMachineContext(RollFive, rollFiveConfig, initialState, {
  autostart: true,
});
