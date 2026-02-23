import {
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import PageLayout from "../../components/PageLayout";
import {
  blackjackConfig,
  type BlackjackCommand,
  type BlackjackState,
  type Card as CardType,
  handTotal,
  initialState,
  isRedSuit,
  suitSymbol,
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
  const hasCards = state.playerHand.length > 0;

  return (
    <PageLayout title="Blackjack">
      <div className="mx-auto max-w-md space-y-6">
        {/* Money & Bet */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">${state.playerMoney}</span>
          {state.bet > 0 && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Bet: ${state.bet}
            </span>
          )}
        </div>

        {/* Dealer Hand */}
        <Hand
          label="Dealer"
          cards={state.dealerHand}
          hiddenIndexes={dealerHidden ? [1] : undefined}
          showTotal={hasCards && !dealerHidden}
        />

        {/* Player Hand */}
        <Hand
          label="You"
          cards={state.playerHand}
          showTotal={hasCards}
        />

        {/* Result Banner */}
        {isSettled && <ResultBanner result={state.result} busted={handTotal(state.playerHand) > 21} />}

        {isGameOver && (
          <div className="rounded-lg bg-gray-100 p-4 text-center">
            <p className="text-lg font-bold text-gray-700">Game Over</p>
            <p className="text-sm text-gray-500">Out of money.</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {isBetting && (
            <>
              <p className="w-full text-sm text-gray-500">Place your bet</p>
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  disabled={amount > state.playerMoney}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    dispatch({ type: "placeBet", amount });
                    advance();
                  }}
                >
                  ${amount}
                </button>
              ))}
            </>
          )}

          {isPlayerTurn && (
            <>
              <button
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                onClick={() => {
                  dispatch({ type: "hit" });
                  advance();
                }}
              >
                Hit
              </button>
              <button
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
                onClick={() => {
                  dispatch({ type: "stand" });
                  advance();
                }}
              >
                Stand
              </button>
            </>
          )}

          {isSettled && (
            <button
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
              onClick={() => advance()}
            >
              Deal Again
            </button>
          )}

          {isGameOver && (
            <button
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
              onClick={() => advance()}
            >
              Play Again
            </button>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// --- Sub-components ---

function Hand({
  label,
  cards,
  hiddenIndexes,
  showTotal,
}: {
  label: string;
  cards: CardType[];
  hiddenIndexes?: number[];
  showTotal?: boolean;
}) {
  const total = handTotal(cards);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-500">{label}</h3>
        {showTotal && (
          <span
            className={clsx("text-sm", {
              "text-red-500": total > 21,
              "text-green-600": total === 21,
              "text-gray-400": total < 21,
            })}
          >
            {total}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.length > 0 ? (
          cards.map((card, i) => (
            <PlayingCard
              key={i}
              card={card}
              faceDown={hiddenIndexes?.includes(i)}
            />
          ))
        ) : (
          <CardPlaceholder />
        )}
      </div>
    </div>
  );
}

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

function PlayingCard({
  card,
  faceDown,
}: {
  card: CardType;
  faceDown?: boolean;
}) {
  if (faceDown) {
    return (
      <div className="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-blue-200 bg-blue-50 shadow-sm">
        <div className="grid grid-cols-3 gap-1 opacity-30">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          ))}
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const symbol = suitSymbol(card.suit);

  return (
    <div
      className={clsx(
        "flex h-24 w-16 flex-col rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm",
        red ? "text-red-500" : "text-gray-900",
      )}
    >
      <div className="leading-none">
        <div className="text-sm font-bold">{card.rank}</div>
        <div className="-mt-0.5 text-xs">{symbol}</div>
      </div>
      <div className="flex flex-1 items-center justify-center text-xl">
        {symbol}
      </div>
    </div>
  );
}

function CardPlaceholder() {
  return (
    <div className="flex h-24 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300" />
  );
}

export default withStateMachineContext(
  Blackjack,
  blackjackConfig,
  initialState,
  { autostart: true },
);
