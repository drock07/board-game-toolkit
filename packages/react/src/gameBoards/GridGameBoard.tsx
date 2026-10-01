import { ComponentPropsWithRef, ReactNode, forwardRef } from "react";

export interface GridGameBoardProps {
  width: number;
  height: number;
  tileSize?: number;
  /**
   * Render function called once per tile with x (column) and y (row)
   * coordinates, both zero-based.
   */
  children?: (x: number, y: number) => ReactNode;
}

export const GridGameBoard = forwardRef<
  HTMLDivElement,
  GridGameBoardProps &
    Omit<ComponentPropsWithRef<"div">, keyof GridGameBoardProps>
>(({ width, height, tileSize, children, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      {...props}
      style={{
        width: tileSize ? tileSize * width : "100%",
        height: tileSize ? tileSize * height : "100%",
        display: "grid",
        gridTemplateColumns: tileSize
          ? `repeat(${width}, ${tileSize}px)`
          : `repeat(${width}, 1fr)`,
        gridTemplateRows: tileSize
          ? `repeat(${height}, ${tileSize}px)`
          : `repeat(${height}, 1fr)`,
        ...style,
      }}
    >
      {Array.from({ length: width * height }).map((_, i) => (
        <div key={i}>{children?.(i % width, Math.floor(i / width))}</div>
      ))}
    </div>
  );
});
