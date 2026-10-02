import { plusTwo } from ".";
import { fuzzTest, rarelyLegal } from "../fuzzCase";

fuzzTest({
  game: plusTwo,
  players: ["p1", "p2", "p3"],
  maxInputs: 120,
  // As in Crazy Eights, three players practically never have to pass
  warnings: [rarelyLegal("pass")],
});
