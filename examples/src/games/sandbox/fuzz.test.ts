import { sandbox } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: sandbox,
  players: ["p1"],
  maxInputs: 40,
});
