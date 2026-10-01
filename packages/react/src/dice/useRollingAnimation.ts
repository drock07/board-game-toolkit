import { roll, type Die } from "@drock07/board-game-toolkit-core/dice";
import { unseededRng } from "@drock07/board-game-toolkit-core/random";
import { useState } from "react";
import { useInterval } from "../hooks/useInterval.js";

export function useRollingAnimation<T>(
  currentValue: T | null,
  die: Die<T>,
  isRolling: boolean,
  delay: number = 80,
) {
  const [rollingValue, setRollingValue] = useState<T>(die.values[0]);

  useInterval(
    () => {
      // Purely visual flicker, so it doesn't need to be reproducible
      setRollingValue(roll(die, unseededRng));
    },
    isRolling ? delay : null,
  );

  const value = isRolling ? rollingValue : currentValue;
  return value;
}
