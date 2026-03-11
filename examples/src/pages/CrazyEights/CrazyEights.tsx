import {
  CardBack,
  CardDimensionsContext,
  CardShape,
  UncontrolledCardHand,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import PageLayout, {
  GlassButton,
  GlassContainer,
} from "../../components/PageLayout";
import {
  type CardColor,
  type CrazyEightsCard,
  type CrazyEightsCommand,
  type CrazyEightsState,
  COLORS,
  canPlayCard,
  crazyEightsConfig,
  initialState,
} from "./config";

// --- Color mapping ---

const COLOR_MAP: Record<CardColor, { bg: string; text: string; ring: string }> =
  {
    red: {
      bg: "bg-red-500",
      text: "text-white",
      ring: "ring-red-400",
    },
    blue: {
      bg: "bg-blue-500",
      text: "text-white",
      ring: "ring-blue-400",
    },
    green: {
      bg: "bg-green-500",
      text: "text-white",
      ring: "ring-green-400",
    },
    yellow: {
      bg: "bg-yellow-400",
      text: "text-gray-900",
      ring: "ring-yellow-300",
    },
  };

const COLOR_HEX: Record<CardColor, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
};

// --- Card Face Component ---

function CrazyEightsCardFace({
  card,
  dimmed,
}: {
  card: CrazyEightsCard;
  dimmed?: boolean;
}) {
  const colors = COLOR_MAP[card.color];
  return (
    <CardShape
      className={clsx(
        "border-2 border-gray-200",
        colors.bg,
        dimmed && "opacity-50",
      )}
    >
      <div
        className={clsx(
          "flex size-full flex-col items-center justify-center",
          colors.text,
        )}
      >
        <div className="text-2xl font-bold">{card.value}</div>
      </div>
    </CardShape>
  );
}

// --- Main Component ---

export function CrazyEights() {
  const currentStates = useStateMachineCurrentState<CrazyEightsState>();
  const state = useStateMachineState<CrazyEightsState>();
  const { advance, dispatch } = useStateMachineActions<
    CrazyEightsState,
    CrazyEightsCommand
  >();

  const isPlayerTurn = currentStates.includes("playerTurn");
  const isSettled = currentStates.includes("settle");

  const topCard =
    state.pools.discardPile[state.pools.discardPile.length - 1] ?? null;

  // Check if player just played an 8 and needs to choose color
  const needsWildChoice =
    isPlayerTurn &&
    topCard?.value === 8 &&
    state.selectedCardId === null &&
    state.wildColorChoice === null &&
    // Detect that the player was the one who played it
    state.pools.player.length <
      state.pools.opponent1.length + state.pools.opponent2.length;

  // Actually, let's use a simpler heuristic: if we're in playerTurn and
  // the top card is an 8 that was just played (wildColorChoice is null)
  // and the player has no card selected, the 8 must have been played by
  // the player in this turn
  const waitingForWildChoice =
    isPlayerTurn && topCard?.value === 8 && state.wildColorChoice === null;

  const playableCards = isPlayerTurn
    ? state.pools.player.filter(
        (c) => topCard && canPlayCard(c, state.activeColor, topCard),
      )
    : [];
  const canDraw =
    isPlayerTurn &&
    playableCards.length === 0 &&
    state.pools.drawPile.length > 0 &&
    !waitingForWildChoice;

  return (
    <CardDimensionsContext width={100}>
      <PageLayout
        title="Crazy Eights"
        topRight={
          <GlassContainer className="flex items-center gap-2 text-sm font-medium">
            <span>Active:</span>
            <span
              className="inline-block size-4 rounded-full ring-2 ring-white/40"
              style={{ backgroundColor: COLOR_HEX[state.activeColor] }}
            />
          </GlassContainer>
        }
        bottomCenter={
          <>
            {isPlayerTurn && !waitingForWildChoice && (
              <>
                <GlassButton
                  disabled={
                    !state.selectedCardId ||
                    !playableCards.some((c) => c.id === state.selectedCardId)
                  }
                  onClick={() => {
                    dispatch({ type: "playCard" });
                    advance();
                  }}
                >
                  Play Card
                </GlassButton>
                <GlassButton
                  disabled={!canDraw}
                  onClick={() => {
                    dispatch({ type: "drawCard" });
                    advance();
                  }}
                >
                  Draw
                </GlassButton>
              </>
            )}
            {isPlayerTurn && waitingForWildChoice && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-white">
                  Choose a color:
                </span>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className="size-10 cursor-pointer rounded-full ring-2 ring-white/40 transition hover:scale-110"
                      style={{ backgroundColor: COLOR_HEX[color] }}
                      onClick={() => {
                        dispatch({ type: "chooseWildColor", color });
                        advance();
                      }}
                      aria-label={`Choose ${color}`}
                    />
                  ))}
                </div>
              </div>
            )}
            {isSettled && (
              <GlassButton onClick={() => advance()}>Play Again</GlassButton>
            )}
          </>
        }
      >
        <div className="relative flex size-full flex-col text-white">
          <PageLayout.SafeInset />
          <div className="flex flex-1 flex-col overflow-auto">
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              {/* Opponents */}
              <div className="flex w-full justify-around px-8">
                <OpponentHand
                  label="Opponent 1"
                  count={state.pools.opponent1.length}
                  isActive={state.currentPlayer === "opponent1"}
                />
                <OpponentHand
                  label="Opponent 2"
                  count={state.pools.opponent2.length}
                  isActive={state.currentPlayer === "opponent2"}
                />
              </div>

              {/* Center: draw pile + discard pile */}
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-1">
                  {state.pools.drawPile.length > 0 ? (
                    <CardBack pattern="green" />
                  ) : (
                    <CardShape className="border border-dashed border-gray-400" />
                  )}
                  <span className="text-xs text-white/60">
                    {state.pools.drawPile.length}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {topCard ? (
                    <CrazyEightsCardFace card={topCard} />
                  ) : (
                    <CardShape className="border border-dashed border-gray-400" />
                  )}
                  <span className="text-xs text-white/60">Discard</span>
                </div>
              </div>

              {/* Result banner */}
              <div className="flex h-16 items-center justify-center">
                {isSettled && state.message && (
                  <div
                    className={clsx("rounded-lg p-4 text-center", {
                      "bg-green-50": state.result === "win",
                      "bg-red-50": state.result === "lose",
                    })}
                  >
                    <p
                      className={clsx("text-lg font-bold", {
                        "text-green-700": state.result === "win",
                        "text-red-700": state.result === "lose",
                      })}
                    >
                      {state.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Player hand */}
              <div className="w-full max-w-2xl px-4">
                <UncontrolledCardHand
                  onSelect={(key) => {
                    if (key) {
                      dispatch({ type: "selectCard", cardId: key });
                    }
                  }}
                  aria-label="Your hand"
                >
                  {state.pools.player.map((card) => {
                    const isPlayable =
                      isPlayerTurn &&
                      topCard &&
                      canPlayCard(card, state.activeColor, topCard);
                    return (
                      <CrazyEightsCardFace
                        key={card.id}
                        card={card}
                        dimmed={isPlayerTurn && !isPlayable}
                      />
                    );
                  })}
                </UncontrolledCardHand>
                <div className="mt-2 text-center text-sm text-white/60">
                  Your Hand ({state.pools.player.length})
                </div>
              </div>
            </div>
            <div className="h-24 w-full" />
          </div>
        </div>
      </PageLayout>
    </CardDimensionsContext>
  );
}

// --- Sub-components ---

function OpponentHand({
  label,
  count,
  isActive,
}: {
  label: string;
  count: number;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={clsx(
          "text-sm",
          isActive ? "font-bold text-white" : "text-white/60",
        )}
      >
        {label}
      </div>
      <div className="flex -space-x-12">
        {Array.from({ length: Math.min(count, 5) }, (_, i) => (
          <CardBack key={i} cardWidth={60} pattern="green" />
        ))}
      </div>
      <div className="text-xs text-white/60">{count} cards</div>
    </div>
  );
}

export default withStateMachineContext(
  CrazyEights,
  crazyEightsConfig,
  initialState,
  { autostart: true },
);
