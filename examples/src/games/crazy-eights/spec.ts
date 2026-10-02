import {
  branch,
  choose,
  decision,
  each,
  loop,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

export const spec = {
  id: "crazy-eights",
  version: 1,
  players: { min: 2, max: 5 },
  zones: {
    deck: { visibility: "hidden" },
    discard: { visibility: "top" },
    hand: { perPlayer: true, visibility: "owner" },
  },
  vars: { activeColor: {}, winner: {} },
  flow: loop(
    "session",
    seq("game", [
      step("deal", "dealSeven"),
      each(
        "turns",
        { players: "clockwise" },
        decision(
          "turn",
          { actor: "current" },
          {
            playCard: {
              then: branch("wild", [
                {
                  when: "playedEight",
                  then: choose("wildColor", {
                    actor: "current",
                    options: "colors",
                    apply: "setColor",
                  }),
                },
              ]),
            },
            drawCard: {},
            pass: {},
          },
        ),
        { until: "someHandEmpty", repeat: true },
      ),
      step("announce", "announceWinner"),
      pause("again", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
