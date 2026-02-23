/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Base configuration shared by states and machines.
 */
interface BaseConfig<TState> {
  /** Called when entering this state/machine. Returns new state. */
  onEnter?: (state: TState) => TState;
  /** Called when exiting this state/machine. Returns new state. */
  onExit?: (state: TState) => TState;
  /** Determines the next state (null = complete/terminal) */
  getNext?: (state: TState) => string | null;
  /** Whether to automatically advance after entering this state */
  autoadvance?: boolean | ((state: TState) => boolean);
}

/**
 * Configuration for a single state in the machine.
 * Distinguished from StateMachineConfig by NOT having id/initial/states.
 */
export interface StateConfig<TState = any> extends BaseConfig<TState> {
  /** Discriminator - states don't have these machine-only properties */
  id?: never;
  initial?: never;
  states?: never;
}

/**
 * Configuration for a state machine.
 * A machine is also a valid state (can be nested).
 */
export interface StateMachineConfig<TState = any> extends BaseConfig<TState> {
  /** Unique identifier for this machine */
  id: string;
  /** Initial state when this machine starts */
  initial: string;
  /** States in this machine (can be StateConfig or nested StateMachineConfig) */
  states: Record<string, StateConfig<TState> | StateMachineConfig<TState>>;
}

/**
 * Check if a config is a machine (has nested states) vs a simple state.
 */
export function isMachine<TState>(
  config: StateConfig<TState> | StateMachineConfig<TState>,
): config is StateMachineConfig<TState> {
  return "states" in config && "initial" in config && "id" in config;
}
