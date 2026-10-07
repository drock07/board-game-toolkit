/**
 * The React host: `useGame`, `useGameEvent`, `useGameEffect`, and the
 * framework-free `GameHost` they wrap.
 *
 * @module @drock07/board-game-toolkit-react
 */
export { useGame, useGameEffect, useGameEvent } from "./hooks.js";
export type { EventOfType, UseGameResult } from "./hooks.js";
export { GameHost } from "./host.js";
export type {
  Bot,
  Controller,
  EventHandler,
  EventType,
  GameHostOptions,
  GameSnapshot,
  PlayerSeat,
  Viewer,
} from "./host.js";
