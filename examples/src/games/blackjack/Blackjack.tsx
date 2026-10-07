import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";
import { AnimatePresence, motion } from "motion/react";
import { blackjack } from ".";
import { GameFrame } from "../../site/GameFrame";
import { CardBack, PlayingCard } from "../../ui/cards";
import { actionInputs, findInput, zoneCards } from "../../ui/inputs";
import { Banner, Button, OptionButton, Stat, wait } from "../../ui/kit";
import type { PlayingCard as Card } from "../shared/cards";
import type { HandResult } from "./game";
import { dealer as dealerZone, handTotal, player as playerZone } from "./game";

const RESULT: Record<
  HandResult,
  { tone: "win" | "lose" | "push"; tag: string }
> = {
  win: { tone: "win", tag: "WIN" },
  blackjack: { tone: "win", tag: "BLACKJACK" },
  push: { tone: "push", tag: "PUSH" },
  lose: { tone: "lose", tag: "LOSE" },
};

function Hand({
  label,
  cards,
}: {
  label: string;
  cards: ReturnType<typeof zoneCards<unknown, Card>>;
}) {
  const visible = cards.flatMap((c) => (c.entity ? [c.entity.props] : []));
  const total =
    cards.length === 0
      ? "–"
      : visible.length < cards.length
        ? "?"
        : handTotal(visible);
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="flex min-h-[168px] gap-3" aria-label={`${label}'s cards`}>
        <AnimatePresence initial={false}>
          {cards.map((c, i) => (
            // Keyed by position: a flipped card keeps its place and turns over
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <motion.div
                key={c.entity ? "face" : "back"}
                initial={{ rotateY: 90 }}
                animate={{ rotateY: 0 }}
                transition={{ duration: 0.18 }}
              >
                {c.entity ? (
                  <PlayingCard card={c.entity.props} />
                ) : (
                  <CardBack />
                )}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="font-semibold text-ink">{label}</span>
        <span className="font-mono">{total}</span>
      </div>
    </div>
  );
}

export default function Blackjack() {
  const g = useGame(blackjack, { players: ["p1"] });
  // Deal one card at a time, and give the hole card a beat before it turns
  useGameEvent(g, "moved", () => wait(260));
  useGameEvent(g, "flipped", () => wait(320));

  const { vars } = g.view;
  // What the game waits on, by its prompt's label
  const label = g.legal.length ? g.view.waiting[0]?.label : undefined;
  // Zones list the top first; show cards in the order they were dealt
  const player = zoneCards(g.view, playerZone).reverse();
  const dealer = zoneCards(g.view, dealerZone).reverse();
  const result = vars.result ?? null;
  const bust =
    player.length > 0 &&
    handTotal(player.flatMap((c) => (c.entity ? [c.entity.props] : []))) > 21;

  const message = (r: HandResult) =>
    ({
      win: `You win! +$${(vars.bet ?? 0) * 2}`,
      blackjack: `Blackjack! +$${Math.floor((vars.bet ?? 0) * 2.5)}`,
      push: "Push — bet returned.",
      lose: bust ? "Bust!" : "Dealer wins.",
    })[r];

  let actions = null;
  const go = findInput(g.legal, "continue");
  if (label === "Place a bet") {
    actions = (
      <div className="flex flex-col items-center gap-2">
        <span className="eyebrow">Place a bet</span>
        <div className="flex flex-wrap justify-center gap-2">
          {actionInputs(g.legal, "placeBet").map((input) => {
            const { amount } = input.args;
            return (
              <OptionButton key={amount} onClick={() => g.submit(input)}>
                {amount === vars.bankroll
                  ? `All in · $${amount}`
                  : `$${amount}`}
              </OptionButton>
            );
          })}
        </div>
      </div>
    );
  } else if (label === "Hit or stand") {
    const hit = findInput(g.legal, "hit");
    const stand = findInput(g.legal, "stand");
    actions = (
      <>
        <Button
          variant="primary"
          disabled={!hit}
          onClick={() => hit && g.submit(hit)}
        >
          Hit
        </Button>
        <Button disabled={!stand} onClick={() => stand && g.submit(stand)}>
          Stand
        </Button>
      </>
    );
  } else if (go) {
    actions = (
      <Button variant="primary" onClick={() => g.submit(go)}>
        {label ?? "Continue"}
      </Button>
    );
  }

  return (
    <GameFrame
      g={g}
      stats={
        <>
          <Stat label="Bank">${vars.bankroll}</Stat>
          <Stat label="Bet">${vars.bet}</Stat>
        </>
      }
      actions={actions}
    >
      <Hand label="Dealer" cards={dealer} />
      <div className="flex h-11 items-center">
        {result && !g.playing && (
          <Banner tone={RESULT[result].tone} tag={RESULT[result].tag}>
            {message(result)}
            {label === "Play again" && " Out of money — the bank tops you up."}
          </Banner>
        )}
      </div>
      <Hand label="You" cards={player} />
    </GameFrame>
  );
}
