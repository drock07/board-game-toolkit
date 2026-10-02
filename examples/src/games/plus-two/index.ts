import { defineGame } from "@drock07/board-game-toolkit-engine";
import { impl } from "./impl";
import { spec } from "./spec";

export const plusTwo = defineGame({ spec, impl });
