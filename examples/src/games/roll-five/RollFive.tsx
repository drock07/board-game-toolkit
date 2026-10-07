import { turnNode } from "@drock07/board-game-toolkit-engine";
import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { rollFive } from ".";
import { GameFrame } from "../../site/GameFrame";
import { Die } from "../../ui/Die";
import { findInput } from "../../ui/inputs";
import { Button, Overlay, Stat, wait } from "../../ui/kit";
import {
  CATEGORIES,
  MAX_ROLLS,
  scoreFor,
  scoreSummary,
  type Category,
  type Vars,
} from "./game";

const LABELS: Record<Category, { name: string; hint: string | number }> = {
  aces: { name: "Aces", hint: 1 },
  twos: { name: "Twos", hint: 2 },
  threes: { name: "Threes", hint: 3 },
  fours: { name: "Fours", hint: 4 },
  fives: { name: "Fives", hint: 5 },
  sixes: { name: "Sixes", hint: 6 },
  threeOfAKind: { name: "3 of a Kind", hint: "Sum all" },
  fourOfAKind: { name: "4 of a Kind", hint: "Sum all" },
  fullHouse: { name: "Full House", hint: "25 pts" },
  smallStraight: { name: "Sm. Str.", hint: "30 pts" },
  largeStraight: { name: "Lg. Str.", hint: "40 pts" },
  rollFive: { name: "Roll Five", hint: "50 pts" },
  chance: { name: "Chance", hint: "Sum all" },
};

function Cell({
  name,
  hint,
  value,
  preview,
  onClick,
  total,
}: {
  name: string;
  hint?: string | number;
  value: number | null;
  preview?: number;
  onClick?: () => void;
  total?: boolean;
}) {
  const body = (
    <>
      <span
        className={clsx(
          "text-center text-xs leading-tight whitespace-nowrap",
          total ? "font-semibold text-accent" : "font-medium text-ink-2",
        )}
      >
        {name}
      </span>
      <span className="flex h-4 items-center font-mono text-[10px] whitespace-nowrap text-label">
        {typeof hint === "number" ? <Die value={hint} size={14} /> : hint}
      </span>
      <span
        className={clsx(
          "flex h-6.5 w-10 items-center justify-center rounded border font-mono text-[13px] font-semibold",
          value !== null
            ? "border-line bg-panel text-ink"
            : preview !== undefined
              ? "border-dashed border-accent-line bg-accent-soft text-accent"
              : "border-line bg-panel text-faint",
        )}
      >
        {value ?? preview ?? ""}
      </span>
    </>
  );
  const cls = clsx(
    "flex min-w-16 flex-1 flex-col items-center gap-1 border-l border-line px-0.5 py-2",
    total && "bg-accent-soft",
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Score ${name} for ${preview}`}
      className={clsx(cls, "cursor-pointer hover:bg-well")}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ScoreSheet({
  vars,
  dice,
  scoreable,
  onScore,
}: {
  vars: Vars;
  dice: readonly number[];
  scoreable: (c: Category) => boolean;
  onScore: (c: Category) => void;
}) {
  const sum = scoreSummary(vars);
  const row = (label: string, cats: readonly Category[], extra: ReactNode) => (
    <div className="flex">
      <div className="flex w-16 shrink-0 items-center justify-center eyebrow text-muted">
        {label}
      </div>
      {cats.map((c) => {
        const can = scoreable(c);
        return (
          <Cell
            key={c}
            name={LABELS[c].name}
            hint={LABELS[c].hint}
            value={vars.scores[c]}
            {...(can && {
              preview: scoreFor(c, dice),
              onClick: () => onScore(c),
            })}
          />
        );
      })}
      {extra}
    </div>
  );
  return (
    <div className="flex overflow-x-auto rounded-[10px] border border-line bg-panel">
      <div className="flex flex-1 flex-col">
        <div className="border-b border-line">
          {row(
            "Upper",
            CATEGORIES.slice(0, 6),
            <>
              <Cell name="Subtotal" value={sum.upperSubtotal} />
              <Cell name="Bonus" hint="≥63 → +35" value={sum.upperBonus} />
              <Cell name="Total" value={sum.upperTotal} total />
            </>,
          )}
        </div>
        {row(
          "Lower",
          CATEGORIES.slice(6),
          <>
            <Cell name="R5 Bonus" hint="100 ea." value={vars.bonus || null} />
            <Cell name="Total" value={sum.lowerTotal} total />
          </>,
        )}
      </div>
      <div className="flex w-21 shrink-0 flex-col items-center justify-center gap-1.5 bg-primary text-on-primary">
        <div className="text-center font-mono text-[10px] font-medium tracking-[0.06em] uppercase opacity-70">
          Grand
          <br />
          total
        </div>
        <div className="font-mono text-[22px] font-medium">
          {sum.grandTotal}
        </div>
      </div>
    </div>
  );
}

export default function RollFive() {
  // #region playback
  const g = useGame(rollFive, { players: ["p1"] });
  // A beat after each roll lands: the dice and the turn's roll count
  // update together, as the flow event plays back
  useGameEvent(g, "flow", () => wait(250));

  const { vars } = g.view;
  const { dice, held } = vars;
  // #region shown
  // The turn counts its own rolls; undefined between games
  const turn = turnNode.shown(g.view);
  const rolls = turn?.counts.roll ?? 0;
  // #endregion shown
  // #endregion playback
  const round = CATEGORIES.filter((c) => vars.scores[c] !== null).length;
  const roll = findInput(g.legal, "roll");
  const again = findInput(g.legal, "again");
  const grand = scoreSummary(vars).grandTotal;

  return (
    <GameFrame
      g={g}
      stats={
        <>
          <Stat label="Score">{grand}</Stat>
          <Stat label="Roll">
            {rolls}/{MAX_ROLLS}
          </Stat>
          <Stat label="Turn">{Math.min(round + 1, 13)}/13</Stat>
        </>
      }
      above={
        <ScoreSheet
          vars={vars}
          dice={dice}
          scoreable={(c) =>
            !!findInput(g.legal, "score", (a) => a.category === c)
          }
          onScore={(c) => {
            const input = findInput(g.legal, "score", (a) => a.category === c);
            if (input) g.submit(input);
          }}
        />
      }
      actions={
        turn && (
          <>
            <Button
              variant="primary"
              disabled={!roll}
              onClick={() => roll && g.submit(roll)}
            >
              {rolls === 0 ? "Roll" : `Roll again (${MAX_ROLLS - rolls} left)`}
            </Button>
            <span className="text-sm text-muted">
              {rolls === 0
                ? "Roll to start your turn"
                : rolls < MAX_ROLLS
                  ? "Click a die to hold it, or pick a score"
                  : "Pick a score"}
            </span>
          </>
        )
      }
    >
      <div className="flex flex-wrap justify-center gap-5">
        {[0, 1, 2, 3, 4].map((i) => {
          // Holding after the last roll changes nothing, so it isn't offered
          const toggle =
            rolls < MAX_ROLLS
              ? findInput(g.legal, "toggleHold", (a) => a.index === i)
              : undefined;
          const isHeld = !!held[i];
          return (
            <div key={i} className="flex flex-col items-center gap-3.5">
              <motion.button
                type="button"
                disabled={!toggle}
                onClick={() => toggle && g.submit(toggle)}
                aria-pressed={isHeld}
                aria-label={`Die ${i + 1}${dice[i] ? `: ${dice[i]}` : ""}${isHeld ? ", held" : ""}`}
                // A new roll value spins the die; held dice stay put
                key={`${i}-${isHeld ? "held" : rolls}`}
                initial={rolls && !isHeld ? { rotate: -90, scale: 0.8 } : false}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className={clsx(
                  "rounded-[9px] outline-offset-4",
                  isHeld && "outline-3 outline-accent",
                  toggle && "cursor-pointer",
                )}
              >
                <Die value={dice[i] ?? 0} />
              </motion.button>
              <span
                className={clsx(
                  "eyebrow",
                  isHeld ? "text-accent" : "invisible",
                )}
              >
                held
              </span>
            </div>
          );
        })}
      </div>
      {again && !g.playing && (
        <Overlay>
          <div className="flex flex-col gap-1.5">
            <div className="eyebrow">Game over</div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-semibold">Final score</span>
              <span className="font-mono text-[32px] font-medium">{grand}</span>
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
