import {
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
import type {
  BattleCard,
  TowerBattlerCommand,
  TowerBattlerState,
} from "./config";
import { towerBattlerConfig, initialState } from "./config";

// --- Card Face ---

const CARD_COLORS: Record<string, string> = {
  Strike: "bg-red-600",
  Defend: "bg-blue-600",
  Bash: "bg-orange-600",
  Sprint: "bg-green-600",
};

function BattleCardFace({
  card,
  dimmed,
}: {
  card: BattleCard;
  dimmed?: boolean;
}) {
  return (
    <CardShape
      className={clsx(
        "border-2 border-gray-200",
        CARD_COLORS[card.name] ?? "bg-gray-600",
        dimmed && "opacity-50",
      )}
    >
      <div className="flex size-full flex-col items-center justify-between py-2 text-white">
        <div className="text-xs font-bold">{card.name}</div>
        <div className="px-1 text-center text-[10px] leading-tight opacity-80">
          {card.description}
        </div>
        <div className="flex size-5 items-center justify-center rounded-full bg-blue-300 text-xs font-bold text-blue-900">
          {card.cost}
        </div>
      </div>
    </CardShape>
  );
}

// --- HP Bar ---

function HpBar({
  current,
  max,
  color,
  label,
}: {
  current: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-white/80">
        <span>{label}</span>
        <span>
          {current}/{max}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/20">
        <div
          className={clsx("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- Main Component ---

export function TowerBattler() {
  const currentStates = useStateMachineCurrentState<TowerBattlerState>();
  const state = useStateMachineState<TowerBattlerState>();
  const { advance, dispatch } = useStateMachineActions<
    TowerBattlerState,
    TowerBattlerCommand
  >();

  const isPlayerTurn = currentStates.includes("playerTurn");
  const isSettled = currentStates.includes("settle");

  const selectedCard = state.selectedCardId
    ? state.pools.hand.find((c) => c.id === state.selectedCardId)
    : null;
  const canPlay = selectedCard != null && selectedCard.cost <= state.energy;

  return (
    <CardDimensionsContext width={90}>
      <PageLayout
        title="TowerBattler"
        topRight={
          <GlassContainer className="flex items-center gap-3 text-sm font-medium">
            <span>Turn {state.turn}</span>
            <span className="text-white/40">|</span>
            <span className="text-blue-300">
              Energy: {state.energy}/{state.maxEnergy}
            </span>
            {state.playerBlock > 0 && (
              <>
                <span className="text-white/40">|</span>
                <span className="text-cyan-300">
                  Block: {state.playerBlock}
                </span>
              </>
            )}
          </GlassContainer>
        }
        bottomCenter={
          <>
            {isPlayerTurn && (
              <>
                <GlassButton
                  disabled={!canPlay}
                  onClick={() => {
                    dispatch({ type: "playCard" });
                  }}
                >
                  Play Card
                </GlassButton>
                <GlassButton
                  onClick={() => {
                    dispatch({ type: "endTurn" });
                  }}
                >
                  End Turn
                </GlassButton>
              </>
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
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              {/* Enemy area */}
              <div className="flex w-full max-w-md flex-col items-center gap-3 px-8">
                <div className="text-lg font-bold">Enemy</div>
                <HpBar
                  current={state.enemyHp}
                  max={state.enemyMaxHp}
                  color="bg-red-500"
                  label="HP"
                />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-300">
                    Intent: Attack for {state.enemyIntent}
                  </span>
                </div>
              </div>

              {/* Message area */}
              <div className="flex h-12 items-center justify-center">
                {state.message && (
                  <div
                    className={clsx(
                      "rounded-lg px-4 py-2 text-center text-sm font-medium",
                      {
                        "bg-green-900/60 text-green-200":
                          state.result === "win",
                        "bg-red-900/60 text-red-200": state.result === "lose",
                        "bg-white/10 text-white/80": !state.result,
                      },
                    )}
                  >
                    {state.message}
                  </div>
                )}
              </div>

              {/* Player area */}
              <div className="flex w-full max-w-md flex-col items-center gap-3 px-8">
                <HpBar
                  current={state.playerHp}
                  max={state.playerMaxHp}
                  color="bg-green-500"
                  label="Player HP"
                />
              </div>

              {/* Deck info */}
              <div className="flex gap-6 text-xs text-white/60">
                <span>Draw: {state.pools.drawPile.length}</span>
                <span>Discard: {state.pools.discardPile.length}</span>
              </div>

              {/* Player hand */}
              <div className="w-full max-w-2xl px-4">
                <UncontrolledCardHand
                  onSelect={(key) => {
                    if (key && isPlayerTurn) {
                      dispatch({ type: "selectCard", cardId: key });
                    }
                  }}
                  aria-label="Your hand"
                >
                  {state.pools.hand.map((card) => (
                    <BattleCardFace
                      key={card.id}
                      card={card}
                      dimmed={!isPlayerTurn || card.cost > state.energy}
                    />
                  ))}
                </UncontrolledCardHand>
                <div className="mt-2 text-center text-sm text-white/60">
                  Hand ({state.pools.hand.length})
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

export default withStateMachineContext(
  TowerBattler,
  towerBattlerConfig,
  initialState,
  { autostart: true },
);
