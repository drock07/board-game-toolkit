import type { CSSProperties } from "react";
import { CardShape, type CardShapeProps } from "./CardShape";

export type CardBackPattern = "dots" | "crosshatch" | "stripes";

export interface CardBackProps {
  /** Card width in pixels. Passed through to CardShape. */
  cardWidth?: CardShapeProps["cardWidth"];
  /** Back design pattern. Default: "dots" */
  pattern?: CardBackPattern;
  /** Additional CSS class name applied to the root CardShape. */
  className?: string;
  /** Style overrides merged on top of defaults. */
  style?: CSSProperties;
}

export function CardBack({
  cardWidth,
  pattern = "dots",
  className,
  style,
}: CardBackProps) {
  const defaultStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  };

  return (
    <CardShape
      cardWidth={cardWidth}
      className={className}
      style={{ ...defaultStyle, ...style }}
    >
      <PatternFill pattern={pattern} />
    </CardShape>
  );
}

function PatternFill({ pattern }: { pattern: CardBackPattern }) {
  switch (pattern) {
    case "dots":
      return <DotsPattern />;
    case "crosshatch":
      return <CrosshatchPattern />;
    case "stripes":
      return <StripesPattern />;
  }
}

function DotsPattern() {
  return (
    <svg
      width="60%"
      height="60%"
      viewBox="0 0 30 30"
      aria-hidden="true"
      style={{ opacity: 0.3 }}
    >
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={5 + col * 10}
            cy={5 + row * 10}
            r="2.5"
            fill="#60a5fa"
          />
        )),
      )}
    </svg>
  );
}

function CrosshatchPattern() {
  return (
    <svg
      width="80%"
      height="80%"
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ opacity: 0.2 }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={`d1-${i}`}
          x1={-20 + i * 10}
          y1={0}
          x2={-20 + i * 10 + 40}
          y2={40}
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={`d2-${i}`}
          x1={60 - i * 10}
          y1={0}
          x2={60 - i * 10 - 40}
          y2={40}
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

function StripesPattern() {
  return (
    <svg
      width="80%"
      height="80%"
      viewBox="0 0 40 56"
      aria-hidden="true"
      style={{ opacity: 0.2 }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <line
          key={i}
          x1={0}
          y1={i * 7}
          x2={40}
          y2={i * 7}
          stroke="#3b82f6"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
