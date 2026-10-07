import type { DeepReadonly } from "@drock07/board-game-toolkit-engine";
import {
  useGame,
  useGameEffect,
  useGameEvent,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { enemyAttack, towerBattler } from ".";
import { GameFrame } from "../../site/GameFrame";
import { Fan } from "../../ui/cards";
import { findInput, zoneCards } from "../../ui/inputs";
import { Banner, Button, Meter, Overlay, Stat, wait } from "../../ui/kit";
import {
  discard,
  drawPile,
  hand as handZone,
  type Card,
  type CardEffect,
  type Hit,
  type Vars,
} from "./game";

const CARD_BG: Record<string, string> = {
  Strike: "#dc2626",
  Defend: "#2563eb",
  Bash: "#ea580c",
  Sprint: "#16a34a",
};

function BattleCard({ card }: { card: DeepReadonly<Card> }) {
  return (
    <div
      className="flex h-[126px] w-[90px] flex-col items-center justify-between rounded-[7px] border-2 border-white/80 py-2 text-white shadow-card"
      style={{ background: CARD_BG[card.name] ?? "#52525b" }}
    >
      <div className="text-xs font-bold">{card.name}</div>
      <div className="px-1 text-center text-[10px] leading-tight opacity-85">
        {card.description}
      </div>
      <div className="flex size-5 items-center justify-center rounded-full bg-blue-300 text-xs font-bold text-blue-900">
        {card.cost}
      </div>
    </div>
  );
}

/** What each effect of a card would change, for the inspector. */
function preview(effect: CardEffect, vars: Vars) {
  switch (effect.type) {
    case "dealDamage":
      return {
        what: `dealDamage ${effect.amount}`,
        change: `enemy.hp ${vars.enemy.hp} → ${Math.max(0, vars.enemy.hp - effect.amount)}`,
      };
    case "gainBlock":
      return {
        what: `gainBlock ${effect.amount}`,
        change: `player.block ${vars.player.block} → ${vars.player.block + effect.amount}`,
      };
    case "draw":
      return {
        what: `draw ${effect.count}`,
        change: `${effect.count} cards → hand`,
      };
  }
}

export default function TowerBattler() {
  const g = useGame(towerBattler, { players: ["p1"] });
  const [selected, setSelected] = useState<string | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);
  useGameEvent(g, "moved", () => wait(90));
  // #region hit
  useGameEffect(g, enemyAttack, async (data) => {
    setHit(data);
    await wait(900);
    setHit(null);
  });
  // #endregion hit

  const { vars } = g.view;
  const { player, enemy } = vars;
  const hand = zoneCards(g.view, handZone);
  const playInput = (id: string) =>
    findInput(g.legal, "playCard", (a) => a.card === id);
  const chosen = selected && playInput(selected) ? selected : null;
  const chosenCard = hand.find((c) => c.entity?.id === chosen)?.entity?.props;
  const endTurn = findInput(g.legal, "endTurn");
  const again = findInput(g.legal, "again");

  return (
    <GameFrame
      g={g}
      stats={
        <>
          <Stat label="Turn">{vars.turn}</Stat>
          <Stat label="Energy" className="text-accent">
            {player.energy}/{player.maxEnergy}
          </Stat>
          <Stat label="Block">{player.block}</Stat>
        </>
      }
      panels={[
        {
          title: "Selected card resolves",
          content: chosenCard ? (
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              {chosenCard.effects.map((e, i) => {
                const p = preview(e, vars);
                return (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="text-ink-2">{p.what}</span>
                    <span className="text-label">{p.change}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-subtle">
              Select a card to preview its effects.
            </p>
          ),
        },
      ]}
      actions={
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
          <Button
            disabled={!endTurn}
            onClick={() => endTurn && g.submit(endTurn)}
          >
            End turn
          </Button>
        </>
      }
    >
      <div className="flex w-full max-w-90 flex-col items-center gap-3 rounded-[10px] border border-line bg-panel px-5 py-4.5">
        <div className="flex w-full items-baseline justify-between">
          <span className="text-base font-semibold">Enemy</span>
          <span className="font-mono text-xs font-medium text-bad">
            Intent · attack {enemy.intent}
          </span>
        </div>
        <Meter
          label="HP"
          value={enemy.hp}
          max={enemy.maxHp}
          tone="bad"
          className="w-full"
        />
      </div>
      <div className="relative w-full max-w-90">
        <Meter
          label="Player HP"
          value={player.hp}
          max={player.maxHp}
          tone="good"
        />
        <AnimatePresence>
          {hit && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: -6 }}
              exit={{ opacity: 0 }}
              role="status"
              className="absolute -top-6 right-0 font-mono text-sm font-semibold text-bad"
            >
              −{hit.damage}
              {hit.blocked > 0 && (
                <span className="text-label"> ({hit.blocked} blocked)</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-5 font-mono text-xs text-subtle">
        <span>draw · {g.view.zones[drawPile.id]?.length ?? 0}</span>
        <span>discard · {g.view.zones[discard.id]?.length ?? 0}</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Fan
          items={hand.map((c) => ({
            key: c.ref,
            lifted: !!chosen && c.entity?.id === chosen,
          }))}
          render={(i) => {
            const c = hand[i]!;
            const { id, props: card } = c.entity!;
            const playable = !!playInput(id);
            return (
              <button
                type="button"
                disabled={!endTurn}
                onClick={() => setSelected(id === chosen ? null : id)}
                aria-pressed={id === chosen}
                aria-label={`${card.name}, costs ${card.cost}${playable ? "" : ", not enough energy"}`}
                className={clsx(
                  "rounded-[7px]",
                  !playable && "brightness-105 saturate-[.3]",
                  id === chosen && "ring-3 ring-accent",
                )}
              >
                <BattleCard card={card} />
              </button>
            );
          }}
        />
        <span className="text-[13px] text-muted">Hand ({hand.length})</span>
      </div>
      {again && !g.playing && (
        <Overlay>
          {vars.result === "win" ? (
            <Banner tone="win" tag="WIN">
              The tower falls on turn {vars.turn}.
            </Banner>
          ) : (
            <Banner tone="lose" tag="LOSE">
              You were defeated.
            </Banner>
          )}
          <Button variant="primary" onClick={() => again && g.submit(again)}>
            Play again
          </Button>
        </Overlay>
      )}
    </GameFrame>
  );
}
