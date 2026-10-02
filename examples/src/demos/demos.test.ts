import { fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { demos } from ".";

test.each(Object.entries(demos))("the %s demo fuzzes clean", (_, demo) => {
  const report = fuzz(demo.game, {
    seeds: 30,
    maxInputs: 40,
    players: demo.players,
  });
  expect(report.failures).toEqual([]);
  expect(report.warnings).toEqual([]);
});
