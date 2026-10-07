import { plusTwo } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: plusTwo,
  players: ["p1", "p2", "p3"],
  maxInputs: 120,
});
