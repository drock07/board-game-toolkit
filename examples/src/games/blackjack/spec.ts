import {
  branch,
  decision,
  loop,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

export const spec = {
  id: "blackjack",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {
    shoe: { visibility: "hidden" },
    player: { visibility: "public" },
    // The hole card is dealt face down (`faceUp: false`) and flipped later
    dealer: { visibility: "public" },
  },
  vars: { bankroll: {}, bet: {}, result: {} },
  flow: loop(
    "session",
    seq("hand", [
      step("newShoe", "newShoe"),
      decision("bet", { actor: "p1" }, { placeBet: {} }),
      step("deal", "dealInitial"),
      seq(
        "play",
        [
          decision(
            "playerTurn",
            { actor: "p1", endWhen: "playerAt21" },
            { hit: { ends: false }, stand: {} },
          ),
          step("dealerTurn", "dealerDraws"),
        ],
        { exits: { natural: "playerHasBlackjack", bust: "playerBust" } },
      ),
      step("settle", "settle"),
      branch(
        "bankroll",
        [
          {
            when: { lte: [{ var: "vars.bankroll" }, 0] },
            then: seq("gameOver", [
              step("resetBankroll", "resetBankroll"),
              pause("over", { label: "Play again" }),
            ]),
          },
        ],
        pause("next", { label: "Deal again" }),
      ),
    ]),
  ),
} as const satisfies GameSpec;
