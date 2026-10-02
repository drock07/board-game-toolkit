import {
  decision,
  loop,
  pause,
  seq,
  step,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

export const spec = {
  id: "tower-battler",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {
    draw: { visibility: "hidden" },
    hand: { visibility: "public" },
    discard: { visibility: "public" },
  },
  vars: { player: {}, enemy: {}, turn: {}, result: {} },
  flow: loop(
    "session",
    seq("match", [
      step("setup", "buildDeckAndDraw"),
      loop(
        "rounds",
        seq("round", [
          decision(
            "playerTurn",
            { actor: "p1" },
            { playCard: { ends: false }, endTurn: {} },
          ),
          step("enemyAttack", "enemyAttack"),
          step("nextTurn", "startNextTurn"),
        ]),
        // Checked after every transaction, so the enemy can fall mid-turn
        {
          exits: {
            won: { lte: [{ var: "vars.enemy.hp" }, 0] },
            lost: { lte: [{ var: "vars.player.hp" }, 0] },
          },
        },
      ),
      step("settle", "announceResult"),
      pause("again", { label: "Play again" }),
    ]),
  ),
} as const satisfies GameSpec;
