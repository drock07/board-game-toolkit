import { blackjack } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: blackjack,
  players: ["p1"],
  maxInputs: 60,
});
