import type { ActionsIn, PlayerId } from "@drock07/board-game-toolkit-engine";
import {
  useGameEvent,
  type UseGameResult,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BackRow, CARD_COLORS, CardBack, ColorCard, Fan } from "../../ui/cards";
import { findInput, zoneCards } from "../../ui/inputs";
import { Button, OptionButton, Overlay, Stat, wait } from "../../ui/kit";
import {
  COLORS,
  deck,
  discard as discardPile,
  hand as handZone,
  type crazyEights,
  type Vars,
} from "./game";

export const NAMES: Record<PlayerId, string> = {
  p1: "You",
  p2: "Opponent 1",
  p3: "Opponent 2",
};
const BACK = "rgb(76,140,125)";

/**
 * The Crazy Eights table for a hosted game: its stats, the table itself and
 * the action row, for a page to lay out.
 */
export function useCrazyEightsTable(
  g: UseGameResult<Vars, ActionsIn<typeof crazyEights>>,
) {
  const [selected, setSelected] = useState<string | null>(null);
  // #region playback
  // Deals run quickly; a single play gets a beat so you can follow the bots
  useGameEvent(g, "moved", (e) => wait(e.to === discardPile.id ? 450 : 70));
  // #endregion playback

  const { vars, players } = g.view;
  // The viewer sits at the bottom; a spectator watches from p1's seat
  const me = players.includes(g.viewer) ? g.viewer : players[0]!;
  const others = players.filter((p) => p !== me);
  const hand = zoneCards(g.view, handZone.of(me));
  const discard = zoneCards(g.view, discardPile);
  const top = discard[0]?.entity?.props;
  const deckCount = g.view.zones[deck.id]?.length ?? 0;
  const calling = g.legal.some((i) => i.action === "setColor");
  const myTurn = g.legal.some(
    (i) =>
      i.action === "playCard" || i.action === "drawCard" || i.action === "pass",
  );
  // Whose turn it is: the one player the open prompt waits on
  const turnOf = g.view.waiting.find((w) => w.label !== "Play again")
    ?.actors[0];
  const playInput = (id: string) =>
    findInput(g.legal, "playCard", (a) => a.card === id);
  const draw = findInput(g.legal, "drawCard");
  const pass = findInput(g.legal, "pass");
  const again = findInput(g.legal, "again");
  const over = g.view.waiting.some((w) => w.label === "Play again");
  const chosen = selected && playInput(selected) ? selected : null;
  const color = vars.activeColor;

  let actions;
  if (calling) {
    actions = (
      <div className="flex flex-col items-center gap-2">
        <span className="eyebrow">Choose the next color</span>
        <div className="flex gap-2">
          {COLORS.map((c) => {
            const input = findInput(g.legal, "setColor", (a) => a.color === c);
            return (
              <OptionButton
                key={c}
                disabled={!input}
                onClick={() => input && g.submit(input)}
                className="capitalize"
              >
                <span
                  className="size-3 rounded-full"
                  style={{ background: CARD_COLORS[c].bg }}
                />
                {c}
              </OptionButton>
            );
          })}
        </div>
      </div>
    );
  } else {
    actions = (
      <>
        <Button
          variant="primary"
          disabled={!chosen}
          onClick={() => {
            const input = chosen && playInput(chosen);
            if (input) {
              setSelected(null);
              g.submit(input);
            }
          }}
        >
          Play card
        </Button>
        <Button disabled={!draw} onClick={() => draw && g.submit(draw)}>
          Draw
        </Button>
        {pass && <Button onClick={() => g.submit(pass)}>Pass</Button>}
      </>
    );
  }

  const stats = (
    <>
      <Stat label="Active color">
        {color && (
          <>
            <span
              className="size-3.5 rounded-full"
              style={{ background: CARD_COLORS[color].bg }}
            />
            <span className="font-sans capitalize">{color}</span>
          </>
        )}
      </Stat>
      <Stat label="Draw pile">{deckCount}</Stat>
      <Stat label="Turn">
        <span className="font-sans">
          {turnOf ? (NAMES[turnOf] ?? turnOf) : "–"}
        </span>
      </Stat>
    </>
  );

  const table = (
    <>
      <div className="flex flex-wrap justify-center gap-x-40 gap-y-6">
        {others.map((p) => {
          const items = g.view.zones[handZone.of(p).id] ?? [];
          return (
            <div key={p} className="flex flex-col items-center gap-2">
              <div
                className={clsx(
                  "text-[13px]",
                  turnOf === p ? "font-semibold text-accent" : "text-muted",
                )}
              >
                {NAMES[p] ?? p}
              </div>
              <BackRow ids={items} color={BACK} />
              <div className="font-mono text-xs text-label">
                {items.length} cards
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-7">
        <div className="flex flex-col items-center gap-2">
          {deckCount ? (
            <CardBack size="md" color={BACK} />
          ) : (
            <div className="h-[112px] w-20 rounded-md border-2 border-dashed border-line-strong" />
          )}
          <span className="font-mono text-xs text-label">
            draw · {deckCount}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-[112px] w-20">
            <AnimatePresence mode="popLayout">
              {top && (
                <motion.div
                  key={discard[0]!.ref}
                  initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                >
                  <ColorCard
                    color={top.color}
                    value={top.value}
                    {...(top.value === 8 && { note: "wild" })}
                    // A wild eight wears the color it called
                    {...(top.value === 8 &&
                      color && {
                        className: "outline-3 outline-offset-2",
                        style: { outlineColor: CARD_COLORS[color].bg },
                      })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="font-mono text-xs text-label">discard</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Fan
          items={hand.map((c) => ({
            key: c.ref,
            lifted: !!c.entity && c.entity.id === chosen,
          }))}
          render={(i) => {
            const c = hand[i]!;
            if (!c.entity) return <CardBack size="md" color={BACK} />;
            const { id } = c.entity;
            const props = c.entity.props;
            const playable = !!playInput(id);
            return (
              <button
                type="button"
                disabled={!myTurn}
                onClick={() => setSelected(id === chosen ? null : id)}
                onDoubleClick={() => {
                  const input = playInput(id);
                  if (input) g.submit(input);
                }}
                aria-pressed={id === chosen}
                aria-label={`${props.color} ${props.value}${playable ? "" : ", can't play"}`}
                className={clsx(
                  "rounded-md transition-opacity",
                  !playable && "brightness-105 saturate-[.3]",
                  id === chosen && "ring-3 ring-accent",
                )}
              >
                <ColorCard
                  color={props.color}
                  value={props.value}
                  {...(props.value === 8 && { note: "wild" })}
                />
              </button>
            );
          }}
        />
        <span className="text-[13px] text-muted">
          {me === "p1" ? "Your hand" : `${NAMES[me] ?? me}'s hand`} (
          {hand.length})
        </span>
      </div>
      {over && !g.playing && (
        <Overlay>
          <div className="flex flex-col gap-1.5">
            <div className="eyebrow">Game over</div>
            <div className="text-xl font-semibold">
              {vars.winner === "p1"
                ? "You win!"
                : vars.winner
                  ? `${NAMES[vars.winner] ?? vars.winner} wins.`
                  : "No winner."}
            </div>
          </div>
          <Button variant="primary" onClick={() => again && g.submit(again)}>
            Play again
          </Button>
        </Overlay>
      )}
    </>
  );

  return { stats, table, actions };
}
