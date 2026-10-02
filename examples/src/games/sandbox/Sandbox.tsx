import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";
import { AnimatePresence, motion } from "motion/react";
import { sandbox } from ".";
import { GameFrame } from "../../site/GameFrame";
import { CardBack, PlayingCard } from "../../ui/cards";
import { findInput, zoneCards } from "../../ui/inputs";
import { Button, Stat, wait } from "../../ui/kit";

export default function Sandbox() {
  const g = useGame(sandbox, { players: ["p1"] });
  useGameEvent(g, "moved", () => wait(120));
  useGameEvent(g, "shuffled", () => wait(300));

  const deck = zoneCards(g.view, "deck");
  const hand = zoneCards(g.view, "hand");
  const discard = zoneCards(g.view, "discard");
  const draw = findInput(g.legal, "draw");
  const shuffleBack = findInput(g.legal, "shuffleBack");
  const top = discard[0]?.entity;

  return (
    <GameFrame
      g={g}
      stats={
        <>
          <Stat label="Deck">{deck.length}</Stat>
          <Stat label="Hand">{hand.length}</Stat>
          <Stat label="Discard">{discard.length}</Stat>
        </>
      }
      actions={
        <>
          <Button
            variant="primary"
            disabled={!draw}
            onClick={() => draw && g.submit(draw)}
          >
            Draw
          </Button>
          <Button
            disabled={!shuffleBack}
            onClick={() => shuffleBack && g.submit(shuffleBack)}
          >
            Shuffle back
          </Button>
        </>
      }
    >
      <div className="flex items-end gap-12">
        <figure className="flex flex-col items-center gap-2">
          <div className="relative h-[112px] w-20">
            {deck.length ? (
              // A few offset backs suggest a stack
              deck.slice(0, 4).map((c, i) => (
                <div
                  key={c.id}
                  className="absolute"
                  style={{ top: -i * 2, left: i * 2 }}
                >
                  <CardBack size="md" />
                </div>
              ))
            ) : (
              <div className="size-full rounded-md border-2 border-dashed border-line-strong" />
            )}
          </div>
          <figcaption className="font-mono text-xs text-label">
            deck · hidden · {deck[0]?.id ?? "empty"}
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <div className="h-[112px] w-20">
            <AnimatePresence mode="popLayout">
              {top ? (
                <motion.div
                  key={top.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <PlayingCard card={top.props} size="md" />
                </motion.div>
              ) : (
                <div className="size-full rounded-md border-2 border-dashed border-line-strong" />
              )}
            </AnimatePresence>
          </div>
          <figcaption className="font-mono text-xs text-label">
            discard · public
          </figcaption>
        </figure>
      </div>
      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex min-h-[124px] max-w-full flex-wrap justify-center gap-2">
          <AnimatePresence>
            {hand.map((c) =>
              c.entity ? (
                <motion.button
                  key={c.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: -30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  whileHover={{ y: -6 }}
                  onClick={() => {
                    const input = findInput(
                      g.legal,
                      "discard",
                      (a) => a.card === c.id,
                    );
                    if (input) g.submit(input);
                  }}
                  aria-label={`Discard ${c.entity.props.rank} of ${c.entity.props.suit}`}
                  className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <PlayingCard card={c.entity.props} size="md" />
                </motion.button>
              ) : null,
            )}
          </AnimatePresence>
        </div>
        <span className="text-sm text-muted">
          Hand · public — click a card to discard it
        </span>
      </div>
    </GameFrame>
  );
}
