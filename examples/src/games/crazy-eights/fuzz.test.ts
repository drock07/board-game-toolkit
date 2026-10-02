import { crazyEights } from ".";
import { fuzzTest, rarelyLegal } from "../fuzzCase";

fuzzTest({
  game: crazyEights,
  players: ["p1", "p2", "p3"],
  maxInputs: 120,
  // Passing needs no playable card and nothing left to draw, which three
  // players practically never reach
  warnings: [rarelyLegal("pass")],
});
