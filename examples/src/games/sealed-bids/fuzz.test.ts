import { sealedBids } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: sealedBids,
  players: ["p1", "p2", "p3"],
  maxInputs: 40,
});
