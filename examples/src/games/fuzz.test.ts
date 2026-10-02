import { fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { blackjack } from "./blackjack";
import { crazyEights } from "./crazy-eights";
import { dungeonCrawl } from "./dungeon-crawl";
import { rollFive } from "./roll-five";
import { sandbox } from "./sandbox";
import { ticTacToe } from "./tic-tac-toe";
import { towerBattler } from "./tower-battler";

// Every ported game must fuzz clean for 1,000 seeds (the milestone
// criterion), which CI runs. Locally it runs 100 for speed; FUZZ_SEEDS
// overrides either.
const SEEDS = Number(process.env.FUZZ_SEEDS ?? (process.env.CI ? 1000 : 100));

const games = [
  { name: "sandbox", game: sandbox, players: ["p1"], maxInputs: 40 },
  { name: "blackjack", game: blackjack, players: ["p1"], maxInputs: 60 },
  { name: "roll-five", game: rollFive, players: ["p1"], maxInputs: 60 },
  {
    name: "tic-tac-toe",
    game: ticTacToe,
    players: ["p1", "p2"],
    maxInputs: 30,
  },
  {
    name: "crazy-eights",
    game: crazyEights,
    players: ["p1", "p2", "p3"],
    maxInputs: 120,
    // Passing needs no playable card and nothing left to draw, which three
    // players practically never reach
    warnings: [
      "impl.actions.pass was never legal without args; if it takes args, give it enumerate",
    ],
  },
  { name: "tower-battler", game: towerBattler, players: ["p1"], maxInputs: 80 },
  { name: "dungeon-crawl", game: dungeonCrawl, players: ["p1"], maxInputs: 80 },
] as const;

for (const { name, game, players, maxInputs, ...rest } of games) {
  test(`${name} fuzzes clean`, () => {
    const report = fuzz(game as Parameters<typeof fuzz>[0], {
      seeds: SEEDS,
      maxInputs,
      players: [...players],
    });
    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual("warnings" in rest ? rest.warnings : []);
    expect(report.inputs).toBeGreaterThan(SEEDS);
  }, 120_000);
}
