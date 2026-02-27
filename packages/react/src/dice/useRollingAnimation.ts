import { roll, type Die } from "@drock07/board-game-toolkit-core/dice";
import { useState } from "react";
import { useInterval } from "../hooks/useInterval";

export function useRollingAnimation<T>(
  currentValue: T | null,
  die: Die<T>,
  isRolling: boolean,
  delay: number = 80,
) {
  const [rollingValue, setRollingValue] = useState<T>(die.values[0]);

  useInterval(
    () => {
      setRollingValue(roll(die));
    },
    isRolling ? delay : null,
  );

  const value = isRolling ? rollingValue : currentValue;
  return value;
}
