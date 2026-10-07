// The Bots guide's claims: a bot sees only its view and legal inputs,
// randomBot picks among them, and playBots plays whole games in a test.
import { randomBot } from "@drock07/board-game-toolkit-engine";
import { playBots } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { rollFive } from "../games/roll-five";
import { CATEGORIES, scoreSummary, type Vars } from "../games/roll-five/game";
import { greedyBot } from "./bots";

/** The grand total of the first finished score sheet. */
const firstGame = (states: { vars: Vars }[]) => {
  const done = states.find((s) =>
    CATEGORIES.every((c) => s.vars.scores[c] !== null),
  );
  if (!done) throw new Error("No game finished");
  return scoreSummary(done.vars).grandTotal;
};

test("the greedy bot outscores random play", () => {
  let greedy = 0;
  let random = 0;
  for (let i = 0; i < 10; i++) {
    // #region playBots
    const { states, inputs } = playBots(rollFive, {
      players: ["p1"],
      seed: `game-${i}`,
      bots: greedyBot, // one bot for every seat, or { p1: …, p2: … }
      maxInputs: 60,
    });
    // #endregion playBots
    expect(inputs.length).toBeGreaterThan(13);
    greedy += firstGame(states);
    random += firstGame(
      playBots(rollFive, {
        players: ["p1"],
        seed: `game-${i}`,
        bots: randomBot(`game-${i}`),
        maxInputs: 300,
      }).states,
    );
  }
  expect(greedy).toBeGreaterThan(random * 1.5);
});

test("playBots is reproducible: the same seed plays the same game", () => {
  const play = () =>
    playBots(rollFive, {
      players: ["p1"],
      seed: "same",
      bots: greedyBot,
      maxInputs: 40,
    }).inputs;
  expect(play()).toEqual(play());
});
