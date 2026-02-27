import { StateMachineConfig } from "@drock07/board-game-toolkit-core";
import { ReactNode } from "react";

export type StateModule<TState> = StateLeafModule | StateMachineModule<TState>;

export interface StateLeafModule {
  component: React.FC;
}

export interface StateMachineModule<TState> {
  stateMachineConfig: StateMachineConfig<TState>;
  layout?: React.FC<{ children?: ReactNode }>;
  childModules?: Record<string, StateModule<TState>>;
}

export function isStateMachineModule<TState>(
  module: StateModule<TState>,
): module is StateMachineModule<TState> {
  return "stateMachineConfig" in module;
}
