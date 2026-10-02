import { dungeonCrawl } from ".";
import { fuzzTest } from "../fuzzCase";

fuzzTest({
  game: dungeonCrawl,
  players: ["p1"],
  maxInputs: 80,
});
