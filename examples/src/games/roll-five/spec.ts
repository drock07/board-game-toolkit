import {
  decision,
  loop,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

export const spec = {
  id: "roll-five",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {},
  vars: { scores: {}, bonus: {} },
  flow: loop(
    "session",
    seq("game", [
      step("reset", "resetScores"),
      loop(
        "rounds",
        decision(
          "turn",
          { actor: "p1" },
          { roll: { ends: false }, toggleHold: { ends: false }, score: {} },
          { locals: "freshDice" },
        ),
        { times: 13 },
      ),
      pause("over", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
