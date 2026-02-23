import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";

// --- Types ---

export interface BlackjackState {
  // TODO
}

export type BlackjackCommand = { type: "TODO" };

// --- Initial State ---

export const initialState: BlackjackState = {};

// --- State Machine Config ---

export const blackjackConfig: StateMachineConfig<
  BlackjackState,
  BlackjackCommand
> = {
  id: "blackjack",
  initial: "betting",
  states: {
    betting: {},
  },
};
