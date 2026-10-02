/**
 * The React host: `useGame`, `useGameEvent`, and the framework-free
 * `GameHost` they wrap.
 *
 * @module @drock07/board-game-toolkit-react
 */
export { useGame, useGameEvent } from "./hooks.js";
export type { EventOfType, UseGameResult } from "./hooks.js";
export { GameHost } from "./host.js";
export type {
  Controller,
  EventHandler,
  GameHostOptions,
  GameSnapshot,
  PlayerSeat,
} from "./host.js";
