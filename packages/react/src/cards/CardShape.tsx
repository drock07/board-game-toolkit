import {
  forwardRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from "react";
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

export const CardShape = forwardRef<
  HTMLDivElement,
  CardShapeProps & Omit<ComponentPropsWithRef<"div">, keyof CardShapeProps>
>(
  (
    {
      cardWidth: customWidth,
      aspectRatio: customAspectRatio,
      style,
      children,
      overlay,
      ...props
    },
    ref,
  ) => {
    const { width: inheritedWidth, aspectRatio: inheritedAspectRatio } =
      useCardDimensionsContext();
    const width = customWidth ?? inheritedWidth;
    const aspectRatio = customAspectRatio ?? inheritedAspectRatio;
    const borderRadius = Math.round(width * 0.08);

    const card = (
      <div
        ref={ref}
        {...props}
        style={{
          ...{
            width: width,
            aspectRatio: `${aspectRatio}`,
            borderRadius,
            overflow: "hidden",
            boxSizing: "border-box",
          },
          ...style,
        }}
      >
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
  },
);
