import { ticTacToe } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: ticTacToe,
  players: ["p1", "p2"],
  maxInputs: 30,
});
