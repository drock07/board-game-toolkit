import { rollFive } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: rollFive,
  players: ["p1"],
  maxInputs: 60,
});
