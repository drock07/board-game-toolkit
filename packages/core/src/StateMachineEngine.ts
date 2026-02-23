import {
  isMachine,
  StateConfig,
  StateMachineConfig,
} from "./types/StateMachineConfig";
import { EngineState, MachineRuntimeState } from "./types/StateMachineEngine";

function peek<TState>(
  stack: MachineRuntimeState<TState>[],
): MachineRuntimeState<TState> | undefined {
  if (stack.length === 0) return undefined;
  return stack[stack.length - 1];
}

function transitionTo<TState>(
  engine: EngineState<TState>,
  stateConfig: StateConfig<TState> | StateMachineConfig<TState>,
): EngineState<TState> {
  if (isMachine(stateConfig)) {
    return startMachine(engine, stateConfig);
  }

  const state = stateConfig.onEnter
    ? stateConfig.onEnter(engine.state)
    : engine.state;
  const newEngine = { ...engine, state };

  const shouldAutoAdvance =
    typeof stateConfig.autoadvance === "function"
      ? stateConfig.autoadvance(state)
      : stateConfig.autoadvance;

  if (shouldAutoAdvance) {
    return advance(newEngine);
  }

  return newEngine;
}

function startMachine<TState>(
  engine: EngineState<TState>,
  config: StateMachineConfig<TState>,
): EngineState<TState> {
  const state = config.onEnter ? config.onEnter(engine.state) : engine.state;
  const machineEntry: MachineRuntimeState<TState> = {
    config,
    currentState: config.initial,
  };
  const newEngine: EngineState<TState> = {
    machineStack: [...engine.machineStack, machineEntry],
    state,
  };

  return transitionTo(newEngine, config.states[config.initial]);
}

/**
 * Resolves the next state for the current machine and transitions to it.
 * Does NOT call onExit for the current state — the caller is responsible
 * for that (advance handles it, completeMachine skips it).
 */
function resolveNext<TState>(engine: EngineState<TState>): EngineState<TState> {
  const { machineStack } = engine;
  const machine = peek(machineStack)!;
  const currentStateConfig = machine.config.states[machine.currentState];
  const nextStateName = currentStateConfig.getNext?.(engine.state) ?? null;

  if (nextStateName === null) {
    return completeMachine(engine);
  }

  const nextStateConfig = machine.config.states[nextStateName];
  const updatedMachine: MachineRuntimeState<TState> = {
    ...machine,
    currentState: nextStateName,
  };
  const newEngine: EngineState<TState> = {
    machineStack: [...machineStack.slice(0, -1), updatedMachine],
    state: engine.state,
  };

  return transitionTo(newEngine, nextStateConfig);
}

/**
 * Completes the current machine: pops it from the stack, calls its onExit,
 * then resolves the parent's next state (if any).
 */
function completeMachine<TState>(
  engine: EngineState<TState>,
): EngineState<TState> {
  const { machineStack } = engine;
  const machine = peek(machineStack)!;

  const exitState = machine.config.onExit
    ? machine.config.onExit(engine.state)
    : engine.state;
  const newStack = machineStack.slice(0, -1);
  const newEngine: EngineState<TState> = {
    machineStack: newStack,
    state: exitState,
  };

  if (newStack.length > 0) {
    // Parent machine resumes — resolve its next state directly
    return resolveNext(newEngine);
  }
  // Top-level machine completed
  return newEngine;
}

/**
 *
 * "Public" methods
 *
 */

export function start<TState>(
  config: StateMachineConfig<TState>,
  initialState: TState,
): EngineState<TState> {
  const engine: EngineState<TState> = {
    machineStack: [],
    state: initialState,
  };
  return startMachine(engine, config);
}

export function advance<TState>(
  engine: EngineState<TState>,
): EngineState<TState> {
  const { machineStack } = engine;
  if (machineStack.length === 0)
    throw new Error("Cannot advance: no active machine");
  const machine = peek(machineStack)!;

  const currentStateConfig = machine.config.states[machine.currentState];
  const state = currentStateConfig.onExit
    ? currentStateConfig.onExit(engine.state)
    : engine.state;

  return resolveNext({ ...engine, state });
}
