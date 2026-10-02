import {
  decision,
  each,
  loop,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

// #region spec
export const spec = {
  id: "tic-tac-toe",
  version: 1,
  players: { min: 2, max: 2 },
  // The board is nine cells in vars, so there are no zones
  zones: {},
  vars: { marks: {}, winner: {}, tie: {}, line: {}, wins: {}, ties: {} },
  flow: loop(
    "session",
    seq("game", [
      step("clear", "clearBoard"),
      each(
        "turns",
        { players: "clockwise", from: "random" },
        decision("place", { actor: "current" }, { placeMark: {} }),
        { until: "boardDecided", repeat: true },
      ),
      step("result", "recordResult"),
      pause("again", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
// #endregion spec
