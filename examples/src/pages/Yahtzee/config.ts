import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";

// --- Types ---

export interface YahtzeeState {
  // TODO
}

export type YahtzeeCommand = { type: "TODO" };

// --- Initial State ---

export const initialState: YahtzeeState = {};

// --- State Machine Config ---

export const yahtzeeConfig: StateMachineConfig<
  YahtzeeState,
  YahtzeeCommand
> = {
  id: "yahtzee",
  initial: "setup",
  states: {
    setup: {},
  },
};
