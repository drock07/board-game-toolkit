import { randomBot, type PlayerId } from "@drock07/board-game-toolkit-engine";
import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { plusTwo } from ".";
import { GameFrame } from "../../site/GameFrame";
import { BackRow, CardBack, ColorCard, Fan } from "../../ui/cards";
import { findInput, zoneCards } from "../../ui/inputs";
import { Button, Overlay, Stat, wait } from "../../ui/kit";
import {
  deck,
  discard,
  hand as handZone,
  TURN_LABEL,
  WINDOW_LABEL,
} from "./game";

const NAMES: Record<PlayerId, string> = { p1: "You", p2: "Bot 2", p3: "Bot 3" };
const name = (p: PlayerId) => NAMES[p] ?? p;
const BACK = "rgb(120,90,150)";

export default function PlusTwo() {
  const g = useGame(plusTwo, {
    players: [
      "p1",
      { id: "p2", controller: randomBot("p2") },
      { id: "p3", controller: randomBot("p3") },
    ],
    botDelay: 800,
  });
  const [selected, setSelected] = useState<string | null>(null);
  useGameEvent(g, "moved", (e) => wait(e.to === discard.id ? 450 : 70));

  const { vars, players } = g.view;
  const me = players.includes(g.viewer) ? g.viewer : players[0]!;
  const others = players.filter((p) => p !== me);
  const hand = zoneCards(g.view, handZone.of(me));
  const top = zoneCards(g.view, discard)[0];
  const topCard = top?.entity?.props;
  const deckCount = g.view.zones[deck.id]?.length ?? 0;
  const waitsOn = (label: string) =>
    g.view.waiting.find((w) => w.label === label)?.actors ?? [];
  const turnOf = waitsOn(TURN_LABEL)[0];
  // What the viewer is asked: their turn, the +2 window, or to play again
  const mine = new Set(
    g.legal.length
      ? g.view.waiting
          .filter((w) => w.actors.includes(g.viewer))
          .map((w) => w.label)
      : [],
  );
  const myTurn = mine.has(TURN_LABEL);
  const inWindow = mine.has(WINDOW_LABEL);
  // A selected card is played or stacked, whichever is open
  const inputFor = (id: string) =>
    findInput(g.legal, "playCard", (a) => a.card === id) ??
    findInput(g.legal, "stackPlusTwo", (a) => a.card === id);
  const chosen = selected && inputFor(selected) ? selected : null;
  const draw = findInput(g.legal, "drawCard");
  const pass = findInput(g.legal, "pass");
  const accept = findInput(g.legal, "accept");
  const again = findInput(g.legal, "again");
  const penalty = vars.penalty ?? 0;

  const play = () => {
    const input = chosen && inputFor(chosen);
    if (input) {
      setSelected(null);
      g.submit(input);
    }
  };

  return (
    <GameFrame
      g={g}
      names={NAMES}
      stats={
        <>
          <Stat label="Penalty" className={clsx(penalty > 0 && "text-bad")}>
            +{penalty}
          </Stat>
          <Stat label="Victim">
            <span className="font-sans">
              {vars.victim ? name(vars.victim) : "–"}
            </span>
          </Stat>
          <Stat label="Draw pile">{deckCount}</Stat>
        </>
      }
      actions={
        <>
          {inWindow && (
            <Button variant="primary" disabled={!chosen} onClick={play}>
              Stack +2
            </Button>
          )}
          {accept && (
            <Button
              variant={inWindow ? "secondary" : "primary"}
              onClick={() => g.submit(accept)}
            >
              Take +{penalty}
            </Button>
          )}
          {myTurn && (
            <>
              <Button variant="primary" disabled={!chosen} onClick={play}>
                Play card
              </Button>
              <Button disabled={!draw} onClick={() => draw && g.submit(draw)}>
                Draw
              </Button>
              {pass && <Button onClick={() => g.submit(pass)}>Pass</Button>}
            </>
          )}
        </>
      }
      stageClassName="justify-between"
    >
      <div className="flex flex-wrap justify-center gap-x-40 gap-y-6">
        {others.map((p) => {
          const items = g.view.zones[handZone.of(p).id] ?? [];
          const active = turnOf === p || vars.victim === p;
          return (
            <div key={p} className="flex flex-col items-center gap-2">
              <div
                className={clsx(
                  "text-[13px]",
                  active ? "font-semibold text-accent" : "text-muted",
                )}
              >
                {name(p)}
                {vars.victim === p && " · on the hook"}
              </div>
              <BackRow ids={items} color={BACK} />
              <div className="font-mono text-xs text-label">
                {items.length} cards
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-9 items-center">
          <AnimatePresence>
            {penalty > 0 && vars.victim && (
              <motion.div
                key="window"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-full border border-bad/30 bg-bad-soft px-3 py-1.5 text-sm font-medium text-bad"
                role="status"
              >
                +{penalty} on {name(vars.victim)} — stack a +2 or take it
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-end gap-7">
          <div className="flex flex-col items-center gap-2">
            {deckCount ? (
              <CardBack size="md" color={BACK} />
            ) : (
              <div className="h-28 w-20 rounded-md border-2 border-dashed border-line-strong" />
            )}
            <span className="font-mono text-xs text-label">
              draw · {deckCount}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-28 w-20">
              <AnimatePresence mode="popLayout">
                {top && topCard && (
                  <motion.div
                    key={top.ref}
                    initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  >
                    <ColorCard color={topCard.color} value={topCard.value} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="font-mono text-xs text-label">discard</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Fan
          items={hand.map((c) => ({
            key: c.ref,
            lifted: !!chosen && c.entity?.id === chosen,
          }))}
          render={(i) => {
            const c = hand[i]!;
            if (!c.entity) return <CardBack size="md" color={BACK} />;
            const card = c.entity.props;
            const id = c.entity.id;
            const playable = !!inputFor(id);
            return (
              <button
                type="button"
                disabled={!myTurn && !inWindow}
                onClick={() => setSelected(id === chosen ? null : id)}
                aria-pressed={id === chosen}
                aria-label={`${card.color} ${card.value}${playable ? "" : ", can't play"}`}
                className={clsx(
                  "rounded-md",
                  !playable && "brightness-105 saturate-[.3]",
                  id === chosen && "ring-3 ring-accent",
                )}
              >
                <ColorCard color={card.color} value={card.value} />
              </button>
            );
          }}
        />
        <span className="text-[13px] text-muted">
          {me === "p1" ? "Your hand" : `${name(me)}'s hand`} ({hand.length})
        </span>
      </div>
      {again && !g.playing && (
        <Overlay>
          <div className="flex flex-col gap-1.5">
            <div className="eyebrow">Game over</div>
            <div className="text-xl font-semibold">
              {vars.winner === "p1"
                ? "You win!"
                : vars.winner
                  ? `${name(vars.winner)} wins.`
                  : "No winner."}
            </div>
          </div>
          <Button variant="primary" onClick={() => again && g.submit(again)}>
            Play again
          </Button>
        </Overlay>
      )}
    </GameFrame>
  );
}
