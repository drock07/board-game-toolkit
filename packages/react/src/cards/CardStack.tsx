import React, { type CSSProperties, type ReactNode } from "react";
import { useCardDimensionsContext } from "./CardDimensionsContext";

/** Deterministic pseudo-random in [0, 1) based on an integer seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export interface CardStackProps {
  children: ReactNode;
  /**
   * Enables a scattered-pile effect. Controls intensity — try values around
   * 6–12 for a natural look. Each non-top card gets a small random rotation
   * and offset, like cards tossed onto a pile. The top card stays straight.
   * When omitted or 0, a soft rounded box-shadow on the top card suggests depth.
   */
  stagger?: number;
  /** Card width in pixels. Falls back to CardDimensionsContext. */
  cardWidth?: number;
  /** Width-to-height aspect ratio. Falls back to CardDimensionsContext. */
  cardAspectRatio?: number;
  className?: string;
  style?: CSSProperties;
}

export function CardStack({
  children,
  stagger = 0,
  cardWidth,
  cardAspectRatio,
  className,
  style,
}: CardStackProps) {
  const { width: contextWidth, aspectRatio: contextAspectRatio } =
    useCardDimensionsContext();
  const resolvedWidth = cardWidth ?? contextWidth;
  const resolvedAspectRatio = cardAspectRatio ?? contextAspectRatio;
  const cardHeight = Math.round(resolvedWidth / resolvedAspectRatio);
  // Matches CardShape's border-radius so the box-shadow follows the card shape
  const borderRadius = Math.round(resolvedWidth * 0.08);

  const items = React.Children.toArray(children);
  const count = items.length;

  const padding = stagger > 0 ? Math.round(stagger) : 0;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: resolvedWidth + padding * 2,
        height: cardHeight + padding * 2,
        ...style,
      }}
    >
      {items.map((child, i) => {
        const isTop = i === count - 1;
        let transform: string | undefined;
        let boxShadow: string | undefined;

        if (stagger > 0 && !isTop) {
          const rotation = (seededRandom(i * 3) - 0.5) * stagger * 1.5;
          const tx = (seededRandom(i * 3 + 1) - 0.5) * stagger * 0.8;
          const ty = (seededRandom(i * 3 + 2) - 0.5) * stagger * 0.5;
          transform = `translate(${tx}px, ${ty}px) rotate(${rotation}deg)`;
        }

        if (isTop && count > 1) {
          // Shadow grows with stack height using sqrt so large decks don't overdo it
          const scale = Math.sqrt(count - 1);
          const yOffset = Math.round(scale * 1.5);
          const blur = Math.round(scale * 3 + 2);
          boxShadow = `0px ${yOffset}px ${blur}px rgba(0,0,0,0.55)`;
        }

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: padding,
              top: padding,
              borderRadius: isTop ? borderRadius : undefined,
              transform,
              boxShadow,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
