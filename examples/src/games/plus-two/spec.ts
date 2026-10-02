import {
  decision,
  each,
  loop,
  parallel,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

/**
 * A small Uno-style game whose +2 cards stack. Playing a +2 opens a response
 * window: any other player may stack another +2 on it, passing the growing
 * penalty on, or the victim takes it. The window is a trigger, so it
 * interrupts whatever played the card, including another window.
 */
export const spec = {
  id: "plus-two",
  version: 1,
  players: { min: 2, max: 4 },
  zones: {
    deck: { visibility: "hidden" },
    discard: { visibility: "top" },
    hand: { perPlayer: true, visibility: "owner" },
  },
  vars: { penalty: {}, victim: {}, winner: {} },
  flow: loop(
    "session",
    seq("game", [
      step("deal", "deal"),
      each(
        "turns",
        { players: "clockwise" },
        decision(
          "turn",
          { actor: "current" },
          { playCard: {}, drawCard: {}, pass: {} },
        ),
        { until: "someHandEmpty", repeat: true },
      ),
      step("announce", "announceWinner"),
      pause("again", { label: "Play again" }),
    ]),
  ),
  triggers: [
    {
      id: "plusTwo",
      on: { type: "moved", from: "hand", to: "discard", entityType: "card" },
      when: "plusTwoPlayed",
      flow: seq(
        "window",
        [
          step("addPenalty", "addPenalty"),
          // The first answer wins: a stack (which opens its own window) or
          // the victim taking the penalty
          parallel(
            "responses",
            [
              decision(
                "stack",
                { actor: { ref: "responders" } },
                { stackPlusTwo: {} },
              ),
              decision(
                "takePenalty",
                { actor: { ref: "victim" } },
                { accept: {} },
              ),
            ],
            { join: "race" },
          ),
        ],
        { locals: "window" },
      ),
    },
  ],
} as const satisfies GameSpec;
