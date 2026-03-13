/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Branded symbol used to distinguish a transition signal from a plain state.
 */
export const TRANSITION_SIGNAL: unique symbol = Symbol("transition");

/**
 * Returned by the `transitionTo` helper inside `execute` to signal
 * that dispatch should transition to a different state.
 */
export interface TransitionSignal<TState> {
  [TRANSITION_SIGNAL]: true;
  state: TState;
  target: string;
  data?: unknown;
}

/**
 * The type of the `transitionTo` helper passed as the third argument to `execute`.
 */
export type TransitionTo<TState> = (
  target: string,
  state: TState,
  data?: unknown,
) => TransitionSignal<TState>;

/**
 * Checks whether a value is a TransitionSignal.
 */
export function isTransitionSignal<TState>(
  value: TState | TransitionSignal<TState>,
): value is TransitionSignal<TState> {
  return (
    typeof value === "object" &&
    value !== null &&
    TRANSITION_SIGNAL in value
  );
}

/**
 * Creates a TransitionSignal. Used internally by the engine
 * to provide the `transitionTo` helper to action handlers.
 */
export function createTransitionSignal<TState>(
  target: string,
  state: TState,
  data?: unknown,
): TransitionSignal<TState> {
  return { [TRANSITION_SIGNAL]: true, state, target, data };
}

/**
 * Default event map type. Games can provide their own interface
 * to get type-safe emit/handler signatures.
 */
export type DefaultEventMap = Record<string, (data: any) => any>;

/**
 * Extracts the data type for a given event key from the event map.
 */
export type EventData<TEvents, K extends keyof TEvents> =
  TEvents[K] extends (data: infer D) => any ? D : {};

/**
 * Extracts the response type for a given event key from the event map.
 */
export type EventResponse<TEvents, K extends keyof TEvents> =
  TEvents[K] extends (data: any) => infer R ? R : void;

/**
 * The emit function available in lifecycle hooks and action handlers.
 * Pauses the engine until the UI handler responds.
 * K is inferred from the `type` property of the event object.
 */
export type EmitFn<TEvents = DefaultEventMap> = <K extends keyof TEvents>(
  event: { type: K } & EventData<TEvents, K>,
) => Promise<EventResponse<TEvents, K>>;

/**
 * The handler function provided by the UI layer to process emitted events.
 * The engine calls this when game code calls emit().
 */
export type EmitHandler = (
  event: { type: string; [key: string]: any },
) => Promise<any>;

/**
 * Context passed to onEnter and onExit lifecycle hooks.
 */
export interface LifecycleContext<TEvents = DefaultEventMap> {
  emit: EmitFn<TEvents>;
}

/**
 * Context passed to action execute handlers.
 * Includes both transitionTo and emit.
 */
export interface ActionContext<TState, TEvents = DefaultEventMap> {
  transitionTo: TransitionTo<TState>;
  emit: EmitFn<TEvents>;
}

/**
 * Handler for a single action/command type.
 */
export interface ActionHandler<TState, TCommand, TEvents = DefaultEventMap> {
  /** Returns whether the command is valid in the current state */
  validate?: (state: TState, command: TCommand) => boolean;
  /** Applies the command to produce a new state, optionally triggering a transition */
  execute: (
    state: TState,
    command: TCommand,
    ctx: ActionContext<TState, TEvents>,
  ) =>
    | TState
    | TransitionSignal<TState>
    | Promise<TState | TransitionSignal<TState>>;
}

/**
 * Maps each command type to its handler, with the command narrowed
 * to the specific union member via Extract.
 */
export type ActionHandlers<
  TState,
  TCommand extends { type: string },
  TEvents = DefaultEventMap,
> = {
  [K in TCommand["type"]]?: ActionHandler<
    TState,
    Extract<TCommand, { type: K }>,
    TEvents
  >;
};

/**
 * The return type of getNext. Can be:
 * - `string` — target state name
 * - `null` — complete/terminal
 * - `[string, unknown]` — target state name with transition data
 */
export type GetNextResult = string | null | [string, unknown];

/**
 * Base configuration shared by states and machines.
 */
interface BaseConfig<
  TState,
  TCommand extends { type: string },
  TEvents = DefaultEventMap,
> {
  /** Called when entering this state/machine. Returns new state. */
  onEnter?: (
    state: TState,
    data: any | undefined,
    ctx: LifecycleContext<TEvents>,
  ) => TState | Promise<TState>;
  /** Called when exiting this state/machine. Returns new state. */
  onExit?: (
    state: TState,
    ctx: LifecycleContext<TEvents>,
  ) => TState | Promise<TState>;
  /** Determines the next state (null = complete/terminal) */
  getNext?: (state: TState) => GetNextResult;
  /** Whether to automatically advance after entering this state */
  autoadvance?: boolean | ((state: TState) => boolean);
  /** Command handlers for this state */
  actions?: ActionHandlers<TState, TCommand, TEvents>;
}

/**
 * Configuration for a single state in the machine.
 * Distinguished from StateMachineConfig by NOT having id/initial/states.
 */
export interface StateConfig<
  TState = any,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> extends BaseConfig<TState, TCommand, TEvents> {
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
  TEvents = DefaultEventMap,
> extends BaseConfig<TState, TCommand, TEvents> {
  /** Unique identifier for this machine */
  id: string;
  /** Initial state when this machine starts */
  initial: string | ((state: TState) => string);
  /** States in this machine (can be StateConfig or nested StateMachineConfig) */
  states: Record<
    string,
    | StateConfig<TState, TCommand, TEvents>
    | StateMachineConfig<TState, TCommand, TEvents>
  >;
}

/**
 * Check if a config is a machine (has nested states) vs a simple state.
 */
export function isMachine<
  TState,
  TCommand extends { type: string },
  TEvents = DefaultEventMap,
>(
  config:
    | StateConfig<TState, TCommand, TEvents>
    | StateMachineConfig<TState, TCommand, TEvents>,
): config is StateMachineConfig<TState, TCommand, TEvents> {
  return "states" in config && "initial" in config && "id" in config;
}
