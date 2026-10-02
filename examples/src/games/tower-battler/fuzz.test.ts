import { towerBattler } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: towerBattler,
  players: ["p1"],
  maxInputs: 80,
});
