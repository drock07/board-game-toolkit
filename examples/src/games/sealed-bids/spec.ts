import {
  decision,
  each,
  loop,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

/** Three items are auctioned; every player bids at once, in secret. */
export const spec = {
  id: "sealed-bids",
  version: 1,
  players: { min: 2, max: 5 },
  zones: {},
  vars: {
    coins: {},
    // Each player sees only their own bid
    bids: { visibility: "owner" },
    items: {},
    lot: {},
    won: {},
    lastResult: {},
    winners: {},
  },
  flow: loop(
    "session",
    seq("game", [
      step("reset", "newGame"),
      loop(
        "rounds",
        seq("round", [
          step("offer", "offerNextItem"),
          each(
            "bidding",
            { players: "clockwise" },
            decision("bid", { actor: "current" }, { placeBid: {} }),
            { mode: "parallel" },
          ),
          step("resolve", "resolveBids"),
        ]),
        { times: 3 },
      ),
      step("score", "finalScores"),
      pause("again", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
