import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";

// --- Types ---

export interface DungeonCrawlState {
  // TODO
}

export type DungeonCrawlCommand = { type: "TODO" };

// --- Initial State ---

export const initialState: DungeonCrawlState = {};

// --- State Machine Config ---

export const dungeonCrawlConfig: StateMachineConfig<
  DungeonCrawlState,
  DungeonCrawlCommand
> = {
  id: "dungeonCrawl",
  initial: "setup",
  states: {
    setup: {},
  },
};
