// #region define
import { defineGame } from "@drock07/board-game-toolkit-engine";
import { impl } from "./impl";
import { spec } from "./spec";

export const ticTacToe = defineGame({ spec, impl });
// #endregion define
export { minimaxBot } from "./bots";
