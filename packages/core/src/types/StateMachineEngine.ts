import { StateMachineConfig } from "./StateMachineConfig";

/**
 * Runtime state of a single machine in the stack.
 * Tracks which machine config is active and the current state name.
 */
export interface MachineRuntimeState<TState = unknown> {
  config: StateMachineConfig<TState>;
  currentState: string;
}

/**
 * The full engine state: the machine stack plus the game state.
 */
export interface EngineState<TState> {
  machineStack: MachineRuntimeState<TState>[];
  state: TState;
  started: boolean;
}
