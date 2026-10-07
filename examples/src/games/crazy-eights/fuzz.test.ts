import { crazyEights } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: crazyEights,
  players: ["p1", "p2", "p3"],
  maxInputs: 120,
});
