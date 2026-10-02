import clsx from "clsx";
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import type { PlayingCard as Card } from "../games/shared/cards";

const SUIT_GLYPH = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

// Pip positions: columns and rows as percentages, from the mockups
const COL_X = [28, 50, 72];
const ROW_Y = [15, 27, 32, 38, 50, 63, 69, 75, 85];
const PIPS: Record<string, [number, number][]> = {
  A: [[1, 4]],
  "2": [
    [1, 0],
    [1, 8],
  ],
  "3": [
    [1, 0],
    [1, 4],
    [1, 8],
  ],
  "4": [
    [0, 0],
    [2, 0],
    [0, 8],
    [2, 8],
  ],
  "5": [
    [0, 0],
    [2, 0],
    [1, 4],
    [0, 8],
    [2, 8],
  ],
  "6": [
    [0, 0],
    [2, 0],
    [0, 4],
    [2, 4],
    [0, 8],
    [2, 8],
  ],
  "7": [
    [0, 0],
    [2, 0],
    [1, 2],
    [0, 4],
    [2, 4],
    [0, 8],
    [2, 8],
  ],
  "8": [
    [0, 0],
    [0, 4],
    [0, 8],
    [1, 2],
    [1, 6],
    [2, 0],
    [2, 4],
    [2, 8],
  ],
  "9": [
    [0, 0],
    [0, 3],
    [0, 5],
    [0, 8],
    [1, 4],
    [2, 0],
    [2, 3],
    [2, 5],
    [2, 8],
  ],
  "10": [
    [0, 0],
    [0, 3],
    [0, 5],
    [0, 8],
    [1, 1],
    [1, 7],
    [2, 0],
    [2, 3],
    [2, 5],
    [2, 8],
  ],
};

const SIZES = {
  sm: { w: 48, h: 67, r: 4 },
  md: { w: 80, h: 112, r: 6 },
  lg: { w: 120, h: 168, r: 10 },
};
export type CardSize = keyof typeof SIZES;

/** The mockups' card back: a patterned panel with a white inset border. */
export function CardBack({
  size = "lg",
  color = "rgb(64,106,142)",
  className,
}: {
  size?: CardSize;
  color?: string;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div
      className={clsx(
        "shrink-0 overflow-hidden bg-white shadow-card",
        className,
      )}
      style={{ width: s.w, height: s.h, borderRadius: s.r }}
      aria-label="Face-down card"
      role="img"
    >
      <svg viewBox="0 0 100 140" className="block size-full" aria-hidden>
        <defs>
          <pattern
            id="card-back"
            width="14"
            height="14"
            patternTransform="translate(1,1)"
            patternUnits="userSpaceOnUse"
            viewBox="0 0 10 10"
          >
            <g opacity="0.8" fill="#fff" stroke="#fff">
              <line x1="0" y1="0" x2="10" y2="10" strokeWidth="0.2" />
              <line x1="0" y1="10" x2="10" y2="0" strokeWidth="0.2" />
              <circle cx="0" cy="0" r="0.8" stroke="none" />
              <circle cx="10" cy="0" r="0.8" stroke="none" />
              <circle cx="5" cy="5" r="0.8" stroke="none" />
              <circle cx="0" cy="10" r="0.8" stroke="none" />
              <circle cx="10" cy="10" r="0.8" stroke="none" />
            </g>
          </pattern>
        </defs>
        <rect x="6" y="6" width="88" height="128" rx="3" fill={color} />
        <rect
          x="7.5"
          y="7.5"
          width="85"
          height="125"
          rx="2"
          fill="url(#card-back)"
          stroke="#fff"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}

/** A standard playing card face. Cards stay white in dark mode. */
export function PlayingCard({
  card,
  size = "lg",
  className,
}: {
  card: Card;
  size?: CardSize;
  className?: string;
}) {
  const s = SIZES[size];
  const scale = s.w / 120;
  const glyph = SUIT_GLYPH[card.suit];
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const pips = PIPS[card.rank];
  const corner = (
    <>
      <span className="font-bold" style={{ fontSize: 15.6 * scale }}>
        {card.rank}
      </span>
      <span style={{ fontSize: 12 * scale }}>{glyph}</span>
    </>
  );
  return (
    <div
      role="img"
      aria-label={`${card.rank} of ${card.suit}`}
      className={clsx(
        "relative shrink-0 overflow-hidden bg-white shadow-card",
        className,
      )}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.r,
        color: red ? "#dc2626" : "#000",
      }}
    >
      <div className="absolute top-[5%] left-[4%] flex flex-col items-center leading-none">
        {corner}
      </div>
      <div className="absolute right-[4%] bottom-[5%] flex rotate-180 flex-col items-center leading-none">
        {corner}
      </div>
      {pips ? (
        pips.map(([c, r], i) => (
          <div
            key={i}
            className="absolute leading-none"
            style={{
              top: `${ROW_Y[r]}%`,
              left: `${COL_X[c]}%`,
              fontSize: (card.rank === "A" ? 72 : 30) * scale,
              transform: `translate(-50%, -50%)${(r === 4 ? c === 2 : r > 4) ? " rotate(180deg)" : ""}`,
            }}
          >
            {glyph}
          </div>
        ))
      ) : (
        <div
          className="absolute top-1/2 left-1/2 -translate-1/2 leading-none font-bold"
          style={{ fontSize: 96 * scale }}
        >
          {card.rank}
        </div>
      )}
    </div>
  );
}

/**
 * Lays cards out in a fan, as in the mockups: overlapping, rotated about
 * their bottom edge. Each child is keyed by its entity id, so cards animate
 * as they come and go.
 */
export function Fan({
  items,
  render,
  overlap = 22,
  spread = 4,
  height = 150,
}: {
  items: { key: string; lifted?: boolean }[];
  render: (index: number) => ReactNode;
  overlap?: number;
  spread?: number;
  height?: number;
}) {
  const mid = (items.length - 1) / 2;
  return (
    <div className="flex items-end justify-center" style={{ height }}>
      {items.map((item, i) => {
        const off = i - mid;
        const rotate = items.length > 1 ? off * spread : 0;
        const y = Math.abs(off) ** 2 * 1.6 - (item.lifted ? 20 : 0);
        return (
          <motion.div
            key={item.key}
            layout
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y, rotate }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{
              marginLeft: i === 0 ? 0 : -overlap,
              transformOrigin: "50% 100%",
              zIndex: item.lifted ? 1 : 0,
            }}
          >
            {render(i)}
          </motion.div>
        );
      })}
    </div>
  );
}

export const CARD_COLORS = {
  red: { bg: "#ef4444", fg: "#fff" },
  blue: { bg: "#3b82f6", fg: "#fff" },
  green: { bg: "#22c55e", fg: "#fff" },
  yellow: { bg: "#eab308", fg: "#111827" },
} as const;
export type CardColor = keyof typeof CARD_COLORS;

/** A solid-colored card with a big value, for Uno-style games. */
export function ColorCard({
  color,
  value,
  size = "md",
  note,
  className,
  style,
}: {
  color: CardColor;
  value: string | number;
  size?: CardSize;
  /** Small text under the value, e.g. "wild". */
  note?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const s = SIZES[size];
  const c = CARD_COLORS[color];
  return (
    <div
      role="img"
      aria-label={`${color} ${value}`}
      className={clsx(
        "flex shrink-0 flex-col items-center justify-center border-2 border-white/80 font-bold shadow-card",
        className,
      )}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.r,
        background: c.bg,
        color: c.fg,
        fontSize: s.w * 0.3,
        ...style,
      }}
    >
      {value}
      {note && (
        <span className="text-[10px] font-semibold tracking-wide uppercase opacity-80">
          {note}
        </span>
      )}
    </div>
  );
}

/** A face-down hand: small overlapping backs and a count. */
export function BackRow({
  ids,
  color,
}: {
  ids: readonly string[];
  color?: string;
}) {
  return (
    <div className="flex">
      {ids.map((id, i) => (
        <motion.div
          key={id}
          layout
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginLeft: i === 0 ? 0 : -36 }}
        >
          <CardBack size="sm" {...(color && { color })} />
        </motion.div>
      ))}
    </div>
  );
}
