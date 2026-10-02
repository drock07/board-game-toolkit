import {
  branch,
  decision,
  loop,
  pause,
  seq,
  step,
  subflow,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";

export const spec = {
  id: "dungeon-crawl",
  version: 1,
  players: { min: 1, max: 1 },
  // The dungeon is a grid in vars, so there are no zones
  zones: {},
  vars: { grid: {}, player: {}, log: {}, result: {} },
  flow: loop(
    "session",
    seq("game", [
      // Generated before `run`, whose guards are checked as soon as it's
      // pushed: a stale dungeon with a dead boss would win again at once
      step("generate", "generateDungeon"),
      seq(
        "run",
        [
          loop(
            "explore",
            seq("visit", [
              decision(
                "move",
                { actor: "p1" },
                { move: {}, useItem: { ends: false } },
              ),
              branch("room", [
                { when: "monsterHere", then: subflow("combat", "combat") },
                {
                  when: "treasureHere",
                  then: seq("treasure", [
                    step("collect", "collectTreasure"),
                    pause("treasurePause"),
                  ]),
                },
                { when: "trapHere", then: subflow("trap", "trap") },
              ]),
            ]),
          ),
        ],
        {
          // Outermost guards win: killing the boss also kills the room's
          // monster, and resolves as victory
          exits: {
            defeat: { lte: [{ var: "vars.player.hp" }, 0] },
            victory: "bossDefeated",
          },
          on: {
            victory: seq("won", [
              step("recordVictory", "recordVictory"),
              pause("wonPause", { label: "Play again" }),
            ]),
            defeat: seq("lost", [
              step("recordDefeat", "recordDefeat"),
              pause("lostPause", { label: "Play again" }),
            ]),
          },
        },
      ),
    ]),
  ),
  subflows: {
    // Inside `subflow("combat", ...)`, node ids are prefixed: "combat.fight"
    combat: loop(
      "fight",
      seq("exchange", [
        decision("playerAttack", { actor: "p1" }, { attack: {}, flee: {} }),
        step("monsterAttack", "monsterAttack"),
      ]),
      {
        locals: "combatFromRoom",
        exits: { killed: "monsterDead" },
        on: {
          killed: step("markDefeated", "markMonsterDefeated"),
          fled: step("logFlee", "logFlee"),
        },
      },
    ),
    trap: seq(
      "trapRoom",
      [
        decision(
          "trapChoice",
          { actor: "p1", endWhen: "trapDismantled" },
          { dismantle: { ends: false }, skip: {} },
        ),
        pause("trapPause"),
      ],
      { locals: "trapFromRoom" },
    ),
  },
} as const satisfies GameSpec;
