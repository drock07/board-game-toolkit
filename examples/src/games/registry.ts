import type { Game } from "@drock07/board-game-toolkit-engine";
import { blackjack } from "./blackjack";
import { crazyEights } from "./crazy-eights";
import { dungeonCrawl } from "./dungeon-crawl";
import { plusTwo } from "./plus-two";
import { rollFive } from "./roll-five";
import { sandbox } from "./sandbox";
import { sealedBids } from "./sealed-bids";
import { ticTacToe } from "./tic-tac-toe";
import { towerBattler } from "./tower-battler";

/** Every example game, by catalog slug. */
export const games: Record<string, Game> = {
  sandbox,
  "tic-tac-toe": ticTacToe,
  blackjack,
  "roll-five": rollFive,
  "dungeon-crawl": dungeonCrawl,
  "crazy-eights": crazyEights,
  "tower-battler": towerBattler,
  "sealed-bids": sealedBids,
  "plus-two": plusTwo,
} as unknown as Record<string, Game>;
