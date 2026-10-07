// The Boards guide's claims: a family's instances, their ids and order, and
// a counted family sized by the player count.
import { init } from "@drock07/board-game-toolkit-engine";
import { applyOrThrow, fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { bag, factory, line, market, take } from "./boards";

test("handles name instances; the count follows the player count", () => {
  expect(factory.at(2).id).toBe("factory:2");
  expect(line.of("ann", 3).id).toBe("line:ann:3");
  for (const [n, factories] of [
    [2, 5],
    [3, 7],
    [4, 9],
  ] as const) {
    const players = ["ann", "bob", "cat", "dan"].slice(0, n);
    const s = init(market, { players, seed: "f" });
    const ids = Object.keys(s.zones);
    expect(ids.filter((z) => z.startsWith("factory:"))).toHaveLength(factories);
    expect(ids.filter((z) => z.startsWith("line:"))).toHaveLength(5 * n);
    // Each factory got four tiles from the bag
    for (let i = 0; i < factories; i++)
      expect(s.zones[`factory:${i}`]).toHaveLength(4);
    expect(s.zones[bag.id]).toHaveLength(36 - 4 * factories);
  }
});

test("taking moves a factory's tiles into one of your lines", () => {
  let s = init(market, { players: ["ann", "bob"], seed: "t" });
  s = applyOrThrow(market, s, take.by("ann", { factory: 3, line: 1 }));
  expect(s.zones["factory:3"]).toEqual([]);
  expect(s.zones["line:ann:1"]).toHaveLength(4);
  expect(s.vars.taken.ann).toBe(4);
});

test("fuzz: every game drains the factories and ends", () => {
  const report = fuzz(market, {
    seeds: 30,
    players: ["ann", "bob", "cat"],
    maxInputs: 20,
  });
  expect(report.failures).toEqual([]);
  expect(report.finished).toBe(30);
});
