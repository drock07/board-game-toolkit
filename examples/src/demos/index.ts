import type { Game } from "@drock07/board-game-toolkit-engine";
import { game as branch } from "./branch";
import { game as choose } from "./choose";
import { game as decision } from "./decision";
import { game as each } from "./each";
import { game as exit } from "./exit";
import { game as families } from "./families";
import { game as loop } from "./loop";
import { game as parallel } from "./parallel";
import { game as pause } from "./pause";
import { game as seq } from "./seq";
import { game as subflow } from "./subflow";
import { game as trigger } from "./trigger";

/** The reference pages' small demo games, by name, with their seats. */
export const demos: Record<string, { game: Game; players: string[] }> = {
  seq: { game: seq, players: ["p1"] },
  loop: { game: loop, players: ["p1"] },
  each: { game: each, players: ["p1", "p2", "p3"] },
  branch: { game: branch, players: ["p1"] },
  decision: { game: decision, players: ["p1"] },
  choose: { game: choose, players: ["p1"] },
  pause: { game: pause, players: ["p1", "p2"] },
  parallel: { game: parallel, players: ["p1", "p2"] },
  exit: { game: exit, players: ["p1"] },
  subflow: { game: subflow, players: ["p1"] },
  trigger: { game: trigger, players: ["p1"] },
  families: { game: families, players: ["p1", "p2"] },
} as unknown as Record<string, { game: Game; players: string[] }>;
