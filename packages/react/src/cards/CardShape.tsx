import type { CSSProperties, ReactNode } from "react";

const DEFAULT_CARD_WIDTH = 64;
const DEFAULT_ASPECT_RATIO = 5 / 7;

export interface CardShapeProps {
  /** Card width in pixels. Height is derived from aspectRatio. Default: 64 */
  cardWidth?: number;
  /** Width-to-height ratio. Default: 5/7 (standard playing card). */
  aspectRatio?: number;
  /** Additional CSS class name applied to the card element. */
  className?: string;
  /** Style overrides merged on top of defaults (consumer values win). */
  style?: CSSProperties;
  /** Content rendered inside the card (clipped to card bounds). */
  children?: ReactNode;
  /** Content rendered above the card with absolute positioning. Not clipped by card overflow. */
  overlay?: ReactNode;
}

export function CardShape({
  cardWidth = DEFAULT_CARD_WIDTH,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  className,
  style,
  children,
  overlay,
}: CardShapeProps) {
  const borderRadius = Math.round(cardWidth * 0.08);

  const defaultStyle: CSSProperties = {
    width: cardWidth,
    aspectRatio: `${aspectRatio}`,
    borderRadius,
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const card = (
    <div className={className} style={{ ...defaultStyle, ...style }}>
      {children}
    </div>
  );

  if (!overlay) return card;

  return (
    <div style={{ position: "relative", width: cardWidth }}>
      {card}
      {overlay}
    </div>
  );
}
