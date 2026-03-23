import { type CSSProperties, type ReactNode } from "react";
import { useCardDimensionsContext } from "./CardDimensionsContext";

interface CardGridBaseProps {
  /** Gap between cards in pixels. Defaults to 12.5% of card width. */
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

interface CardGridDenseProps extends CardGridBaseProps {
  children: ReactNode;
  /** Number of columns. Omit to auto-fill based on card width. */
  columns?: number;
  rows?: never;
}

interface CardGridSparseProps extends CardGridBaseProps {
  /**
   * Render function called for each cell in the grid. Receives the
   * x (column) and y (row) coordinates, both zero-based. Return the
   * card node to render, or null/undefined for an empty slot.
   */
  children: (x: number, y: number) => ReactNode;
  /** Number of columns. Required in sparse mode. */
  columns: number;
  /** Number of rows. Required in sparse mode. */
  rows: number;
}

export type CardGridProps = CardGridDenseProps | CardGridSparseProps;

export function CardGrid({
  children,
  columns,
  rows,
  gap,
  className,
  style,
}: CardGridProps) {
  const { width: cardWidth } = useCardDimensionsContext();
  const resolvedGap = gap ?? Math.round(cardWidth * 0.125);

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: columns
      ? `repeat(${columns}, max-content)`
      : `repeat(auto-fill, ${cardWidth}px)`,
    gap: resolvedGap,
    ...style,
  };

  if (typeof children === "function") {
    return (
      <div className={className} style={gridStyle}>
        {Array.from({ length: (rows as number) * columns! }, (_, i) => {
          const x = i % columns!;
          const y = Math.floor(i / columns!);
          return <div key={i}>{children(x, y)}</div>;
        })}
      </div>
    );
  }

  return (
    <div className={className} style={gridStyle}>
      {children}
    </div>
  );
}
