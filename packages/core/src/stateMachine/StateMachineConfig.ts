/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Handler for a single action/command type.
 */
export interface ActionHandler<TState, TCommand> {
  /** Returns whether the command is valid in the current state */
  validate?: (state: TState, command: TCommand) => boolean;
  /** Applies the command to produce a new state */
  execute: (state: TState, command: TCommand) => TState;
}

/**
 * Maps each command type to its handler, with the command narrowed
 * to the specific union member via Extract.
 */
export type ActionHandlers<
  TState,
  TCommand extends { type: string },
> = {
  [K in TCommand["type"]]?: ActionHandler<
    TState,
    Extract<TCommand, { type: K }>
  >;
};

/**
 * Base configuration shared by states and machines.
 */
interface BaseConfig<TState, TCommand extends { type: string }> {
  /** Called when entering this state/machine. Returns new state. */
  onEnter?: (state: TState) => TState;
  /** Called when exiting this state/machine. Returns new state. */
  onExit?: (state: TState) => TState;
  /** Determines the next state (null = complete/terminal) */
  getNext?: (state: TState) => string | null;
  /** Whether to automatically advance after entering this state */
  autoadvance?: boolean | ((state: TState) => boolean);
  /** Command handlers for this state */
  actions?: ActionHandlers<TState, TCommand>;
}

/**
 * Configuration for a single state in the machine.
 * Distinguished from StateMachineConfig by NOT having id/initial/states.
 */
export interface StateConfig<
  TState = any,
  TCommand extends { type: string } = any,
> extends BaseConfig<TState, TCommand> {
  /** Discriminator - states don't have these machine-only properties */
  id?: never;
  initial?: never;
  states?: never;
}

/**
 * Configuration for a state machine.
 * A machine is also a valid state (can be nested).
 */
export interface StateMachineConfig<
  TState = any,
  TCommand extends { type: string } = any,
> extends BaseConfig<TState, TCommand> {
  /** Unique identifier for this machine */
  id: string;
  /** Initial state when this machine starts */
  initial: string | ((state: TState) => string);
  /** States in this machine (can be StateConfig or nested StateMachineConfig) */
  states: Record<
    string,
    StateConfig<TState, TCommand> | StateMachineConfig<TState, TCommand>
  >;
}

/**
 * Check if a config is a machine (has nested states) vs a simple state.
 */
export function isMachine<TState, TCommand extends { type: string }>(
  config:
    | StateConfig<TState, TCommand>
    | StateMachineConfig<TState, TCommand>,
): config is StateMachineConfig<TState, TCommand> {
  return "states" in config && "initial" in config && "id" in config;
}
