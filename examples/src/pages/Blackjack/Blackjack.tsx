import {
  CardBack,
  CardDimensionsContext,
  CardShape,
  StandardPlayingCard,
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
  type BlackjackCommand,
  type BlackjackState,
  blackjackConfig,
  handTotal,
  initialState,
} from "./config";

export function Blackjack() {
  const currentStates = useStateMachineCurrentState<BlackjackState>();
  const state = useStateMachineState<BlackjackState>();
  const { advance, dispatch } = useStateMachineActions<
    BlackjackState,
    BlackjackCommand
  >();

  const isBetting = currentStates.includes("betting");
  const isPlayerTurn = currentStates.includes("playerTurn");
  const isSettled = currentStates.includes("settle");
  const isGameOver = currentStates.includes("gameOver");
  const dealerHidden = isPlayerTurn;

  return (
    <CardDimensionsContext width={150}>
      <PageLayout
        title="Blackjack"
        topRight={
          <>
            {state.bet > 0 && (
              <GlassContainer className="text-sm font-medium">
                Bet: ${state.bet}
              </GlassContainer>
            )}
            <GlassContainer className="text-lg font-semibold">
              ${state.playerMoney}
            </GlassContainer>
          </>
        }
        bottomCenter={
          <>
            {isBetting && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <div className="text-sm text-white">Bet:</div>
                  <div className="flex gap-2">
                    {[10, 25, 50, 100].map((amount) => (
                      <GlassButton
                        key={amount}
                        circle
                        disabled={!isBetting || amount > state.playerMoney}
                        onClick={() => {
                          dispatch({ type: "placeBet", amount });
                          advance();
                        }}
                      >
                        ${amount}
                      </GlassButton>
                    ))}
                  </div>
                </div>
              </>
            )}
            {isPlayerTurn && (
              <>
                <GlassButton
                  disabled={!isPlayerTurn}
                  onClick={() => {
                    dispatch({ type: "hit" });
                    advance();
                  }}
                >
                  Hit
                </GlassButton>
                <GlassButton
                  disabled={!isPlayerTurn}
                  onClick={() => {
                    dispatch({ type: "stand" });
                    advance();
                  }}
                >
                  Stand
                </GlassButton>
              </>
            )}
            {isSettled && (
              <GlassButton onClick={() => advance()}>Deal Again</GlassButton>
            )}
            {isGameOver && (
              <GlassButton onClick={() => advance()}>Play Again</GlassButton>
            )}
          </>
        }
      >
        <div className="relative flex size-full flex-col text-white">
          <PageLayout.SafeInset />
          <div className="flex flex-1 flex-col overflow-auto">
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              {/* dealer hand */}
              <div className="flex flex-col">
                <div className="mb-12 text-center text-2xl">
                  Dealer{" "}
                  {dealerHidden || handTotal(state.dealerHand) === 0
                    ? null
                    : ` (${handTotal(state.dealerHand)})`}
                </div>
                {state.dealerHand.length > 0 ? (
                  dealerHidden ? (
                    <div className="relative translate-x-4">
                      <CardBack className="absolute -top-8 -left-8" />
                      <StandardPlayingCard card={state.dealerHand[1]} />
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      {state.dealerHand.map((card) => (
                        <StandardPlayingCard
                          key={`${card.rank}${card.suit}`}
                          card={card}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <CardPlaceholder />
                )}
              </div>

              {/* messages */}
              <div className="flex h-22 items-center justify-center">
                {isSettled && (
                  <ResultBanner
                    result={state.result}
                    busted={handTotal(state.playerHand) > 21}
                  />
                )}
              </div>

              {/* player hand */}
              <div>
                <div className="flex gap-4">
                  {state.playerHand.length > 0 ? (
                    state.playerHand.map((card) => (
                      <StandardPlayingCard
                        key={`${card.rank}${card.suit}`}
                        card={card}
                      />
                    ))
                  ) : (
                    <CardPlaceholder />
                  )}
                </div>
                <div className="mt-4 text-center text-2xl">
                  You
                  {handTotal(state.playerHand) === 0
                    ? null
                    : ` (${handTotal(state.playerHand)})`}
                </div>
              </div>
            </div>
            <div className="h-24 w-full" />
          </div>
          {isGameOver && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-gray-100 p-4 text-center">
              <p className="text-lg font-bold text-gray-700">Game Over</p>
              <p className="text-sm text-gray-500">Out of money.</p>
            </div>
          )}
        </div>
      </PageLayout>
    </CardDimensionsContext>
  );
}

// --- Sub-components ---

function ResultBanner({
  result,
  busted,
}: {
  result: BlackjackState["result"];
  busted: boolean;
}) {
  const isWin = result === "win" || result === "blackjack";
  const isLoss = result === "lose";

  return (
    <div
      className={clsx("rounded-lg p-4 text-center", {
        "bg-green-50": isWin,
        "bg-red-50": isLoss,
        "bg-gray-100": result === "push",
      })}
    >
      <p
        className={clsx("text-lg font-bold", {
          "text-green-700": isWin,
          "text-red-700": isLoss,
          "text-gray-700": result === "push",
        })}
      >
        {result === "blackjack" && "Blackjack!"}
        {result === "win" && "You win!"}
        {result === "lose" && (busted ? "Bust!" : "Dealer wins.")}
        {result === "push" && "Push — bet returned."}
      </p>
    </div>
  );
}

function CardPlaceholder({ className }: { className?: string }) {
  return (
    <CardShape
      className={clsx("border border-dashed border-gray-300", className)}
    />
  );
}

export default withStateMachineContext(
  Blackjack,
  blackjackConfig,
  initialState,
  { autostart: true },
);
