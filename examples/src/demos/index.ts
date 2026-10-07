import type { AnyGame } from "../games/registry";
import { game as anyone } from "./anyone";
import { game as branch } from "./branch";
import { game as effects } from "./effects";
import { game as everyone } from "./everyone";
import { game as families } from "./families";
import { game as loop } from "./loop";
import { game as outcomes } from "./outcomes";
import { game as prompt } from "./prompt";
import { game as seq } from "./seq";
import { game as simultaneous } from "./simultaneous";
import { game as step } from "./step";
import { game as turn } from "./turn";
import { game as turns } from "./turns";

/** The reference pages' small demo games, by name, with their seats. */
export const demos: Record<string, { game: AnyGame; players: string[] }> = {
  seq: { game: seq, players: ["p1"] },
  step: { game: step, players: ["p1"] },
  turns: { game: turns, players: ["p1", "p2", "p3"] },
  turn: { game: turn, players: ["p1"] },
  loop: { game: loop, players: ["p1"] },
  branch: { game: branch, players: ["p1"] },
  outcomes: { game: outcomes, players: ["p1"] },
  prompt: { game: prompt, players: ["p1"] },
  everyone: { game: everyone, players: ["p1", "p2"] },
  anyone: { game: anyone, players: ["p1", "p2", "p3"] },
  simultaneous: { game: simultaneous, players: ["p1", "p2"] },
  effects: { game: effects, players: ["p1"] },
  families: { game: families, players: ["p1", "p2"] },
} as unknown as Record<string, { game: AnyGame; players: string[] }>;
