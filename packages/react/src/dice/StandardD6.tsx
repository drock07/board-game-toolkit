import { Dice, type D6Result } from "@drock07/board-game-toolkit-core";
import { ComponentPropsWithoutRef } from "react";
import { useRollingAnimation } from "./useRollingAnimation";

type Pip = [0 | 1 | 2, 0 | 1 | 2];

const POS = [8, 15, 22];
const PIP_LAYOUTS: Record<D6Result, Pip[]> = {
  // prettier-ignore
  1: [[1, 1]],
  // prettier-ignore
  2: [[0, 2], [2, 0]],
  // prettier-ignore
  3: [[0, 2], [1, 1], [2, 0]],
  // prettier-ignore
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  // prettier-ignore
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  // prettier-ignore
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

export interface StandardD6Props {
  value: D6Result | null;
  rolling?: boolean;
  pipColor?: string;
  dieColor?: string;
  borderColor?: string;
}
export function StandardD6({
  value,
  rolling = false,
  dieColor = "white",
  pipColor = "black",
  borderColor = "#5b5b5b",
  ...props
}: StandardD6Props &
  Omit<ComponentPropsWithoutRef<"svg">, keyof StandardD6Props | "viewBox">) {
  const faceValue = useRollingAnimation(value, Dice.D6, rolling);

  if (faceValue === null) {
    return (
      <svg {...props} viewBox="0 0 30 30">
        <rect
          x={0.5}
          y={0.5}
          width={29}
          height={29}
          rx="10%"
          fill={dieColor}
          stroke={borderColor}
          strokeWidth={0.6}
        />
      </svg>
    );
  }

  return (
    <svg {...props} viewBox="0 0 30 30">
      <rect
        x={0.5}
        y={0.5}
        width={29}
        height={29}
        rx="10%"
        fill={dieColor}
        stroke={borderColor}
        strokeWidth={0.6}
      />
      {PIP_LAYOUTS[faceValue].map(([col, row], i) => (
        <circle key={i} cx={POS[col]} cy={POS[row]} r="2.5" fill={pipColor} />
      ))}
    </svg>
  );
}
