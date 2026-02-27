import type { CSSProperties, ReactNode } from "react";
import { useCardDimensionsContext } from "./CardDimensionsContext";

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
  cardWidth: customWidth,
  aspectRatio: customAspectRatio,
  className,
  style,
  children,
  overlay,
}: CardShapeProps) {
  const { width: inheritedWidth, aspectRatio: inheritedAspectRatio } =
    useCardDimensionsContext();
  const width = customWidth ?? inheritedWidth;
  const aspectRatio = customAspectRatio ?? inheritedAspectRatio;
  const borderRadius = Math.round(width * 0.08);

  const defaultStyle: CSSProperties = {
    width: width,
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
    <div style={{ position: "relative", width: width }}>
      {card}
      {overlay}
    </div>
  );
}
