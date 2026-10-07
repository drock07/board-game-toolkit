import { randomBot, type PlayerId } from "@drock07/board-game-toolkit-engine";
import { useGame, useGameEffect } from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { sealedBids } from ".";
import { GameFrame } from "../../site/GameFrame";
import { actionInputs, findInput, zoneCards } from "../../ui/inputs";
import {
  Banner,
  Button,
  Hint,
  OptionButton,
  Overlay,
  Stat,
  wait,
} from "../../ui/kit";
import { ITEMS, points, sealed, sold } from "./game";

const NAMES: Record<PlayerId, string> = { p1: "You", p2: "Bot 2", p3: "Bot 3" };
const name = (p: PlayerId) => NAMES[p] ?? p;

export default function SealedBids() {
  // #region host
  const g = useGame(sealedBids, {
    players: [
      "p1",
      { id: "p2", controller: randomBot("p2") },
      { id: "p3", controller: randomBot("p3") },
    ],
    botDelay: 900,
  });
  // Give each round's result a moment on screen
  useGameEffect(g, sold, () => wait(600));
  // #endregion host

  const { vars, players } = g.view;
  const me = players.includes(g.viewer) ? g.viewer : null;
  const bids = actionInputs(g.legal, "placeBid");
  // #region waiting
  const waitingOn = new Set(
    g.view.waiting
      .filter((w) => w.label === "Place a sealed bid")
      .flatMap((w) => w.actors),
  );
  // #endregion waiting
  const { coins, won } = vars;
  const scored = { coins, won };
  const lotsLeft = vars.items.length + (vars.lot ? 1 : 0);
  const again = findInput(g.legal, "again");
  const over = g.view.waiting.some((w) => w.label === "Play again");
  const result = vars.lastResult;

  return (
    <GameFrame
      g={g}
      names={NAMES}
      stats={
        <>
          <Stat label="Coins">{me ? (coins[me] ?? 0) : "–"}</Stat>
          <Stat label="Points">{me ? points(scored, me) : "–"}</Stat>
          <Stat label="Lot">
            {Math.min(ITEMS.length - lotsLeft + 1, ITEMS.length)}/{ITEMS.length}
          </Stat>
        </>
      }
      actions={
        bids.length ? (
          <div className="flex flex-col items-center gap-2">
            <span className="eyebrow">Your sealed bid</span>
            <div className="flex flex-wrap justify-center gap-2">
              {bids.map((input) => {
                const { amount } = input.args;
                return (
                  <OptionButton key={amount} onClick={() => g.submit(input)}>
                    {amount}
                  </OptionButton>
                );
              })}
            </div>
          </div>
        ) : me && waitingOn.size ? (
          <Hint>
            Bid sealed — waiting on {[...waitingOn].map(name).join(" and ")}
          </Hint>
        ) : null
      }
    >
      <div className="flex h-12 items-center">
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={`${result.winner}-${result.item.name}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Banner tone={result.winner === "p1" ? "win" : "push"} tag="SOLD">
                {name(result.winner)} won the {result.item.name} for{" "}
                {result.paid}
              </Banner>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="popLayout">
        {vars.lot ? (
          <motion.div
            key={vars.lot.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex w-56 flex-col items-center gap-2 rounded-xl border border-line bg-panel px-6 py-5"
          >
            <span className="eyebrow">Up for auction</span>
            <span className="text-2xl font-semibold">{vars.lot.name}</span>
            <span className="font-mono text-sm text-muted">
              worth {vars.lot.value} points
            </span>
          </motion.div>
        ) : (
          <div className="h-[116px]" />
        )}
      </AnimatePresence>
      <ul className="grid w-full max-w-180 gap-3 sm:grid-cols-3">
        {players.map((p) => {
          // A bid shows only to its bidder: others see a hidden entity
          const myBid = zoneCards(g.view, sealed.of(p))[0]?.entity?.props
            .amount;
          return (
            <li
              key={p}
              className={clsx(
                "flex flex-col gap-2 rounded-[10px] border bg-panel p-3.5",
                p === me ? "border-accent-line" : "border-line",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{name(p)}</span>
                <span className="font-mono text-xs text-label">
                  {coins[p] ?? 0} coins · {points(scored, p)} pts
                </span>
              </div>
              <div className="font-mono text-xs">
                {waitingOn.has(p) ? (
                  <span className="text-subtle">deciding…</span>
                ) : myBid !== undefined ? (
                  <span className="text-accent">bid {myBid}</span>
                ) : vars.lot ? (
                  <span className="text-ink-2">✉ bid sealed</span>
                ) : (
                  <span className="text-subtle">–</span>
                )}
              </div>
              <div className="flex min-h-6 flex-wrap gap-1.5">
                {(won[p] ?? []).map((item) => (
                  <span
                    key={item.name}
                    className="rounded border border-line bg-well px-1.5 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {item.name} +{item.value}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {over && !g.playing && (
        <Overlay>
          <div className="flex flex-col gap-1.5">
            <div className="eyebrow">Final scores</div>
            <div className="text-xl font-semibold">
              {vars.winners.includes("p1")
                ? "You win!"
                : `${vars.winners.map(name).join(" and ")} win${vars.winners.length === 1 ? "s" : ""}.`}
            </div>
          </div>
          <ol className="flex flex-col gap-1 font-mono text-sm">
            {[...players]
              .sort((a, b) => points(scored, b) - points(scored, a))
              .map((p) => (
                <li key={p} className="flex justify-between">
                  <span>{name(p)}</span>
                  <span>{points(scored, p)}</span>
                </li>
              ))}
          </ol>
          <Button variant="primary" onClick={() => again && g.submit(again)}>
            Play again
          </Button>
        </Overlay>
      )}
    </GameFrame>
  );
}
