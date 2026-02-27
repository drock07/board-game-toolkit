import { ComponentPropsWithRef, ReactNode, forwardRef } from "react";

export interface GridGameBoardProps {
  width: number;
  height: number;
  tileSize?: number;
  children?: (x: number, y: number) => ReactNode;
}

export const GridGameBoard = forwardRef<
  HTMLDivElement,
  GridGameBoardProps &
    Omit<ComponentPropsWithRef<"div">, keyof GridGameBoardProps>
>(({ width, height, tileSize, children, ...props }, ref) => {
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
      }}
    >
      {Array.from({ length: width * height }).map((_, i) => (
        <div key={i}>{children?.(Math.floor(i / width), i % width)}</div>
      ))}
    </div>
  );
});
