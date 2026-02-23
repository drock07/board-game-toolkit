import { StateMachineConfig } from "./StateMachineConfig";

/**
 * Runtime state of a single machine in the stack.
 * Tracks which machine config is active and the current state name.
 */
export interface MachineRuntimeState<
  TState = unknown,
  TCommand extends { type: string } = any,
> {
  config: StateMachineConfig<TState, TCommand>;
  currentState: string;
}

/**
 * The full engine state: the machine stack plus the game state.
 */
export interface EngineState<
  TState,
  TCommand extends { type: string } = any,
> {
  machineStack: MachineRuntimeState<TState, TCommand>[];
  state: TState;
  started: boolean;
  history: TCommand[];
}
