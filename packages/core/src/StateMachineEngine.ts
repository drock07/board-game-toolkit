import {
  isMachine,
  StateConfig,
  StateMachineConfig,
} from "./types/StateMachineConfig";
import {
  ActionFn,
  EngineState,
  MachineRuntimeState,
} from "./types/StateMachineEngine";

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
    ...engine,
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
    ...engine,
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
    ...engine,
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

export function createEngine<TState>(
  initialState: TState,
): EngineState<TState> {
  return {
    machineStack: [],
    state: initialState,
    started: false,
  };
}

export function start<TState>(
  engine: EngineState<TState>,
  config: StateMachineConfig<TState>,
): EngineState<TState> {
  if (engine.started) throw new Error("Cannot start: machine already started");
  return startMachine(
    {
      ...engine,
      started: true,
    },
    config,
  );
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

export function doAction<TState, TArgs extends unknown[]>(
  engine: EngineState<TState>,
  action: ActionFn<TState, TArgs>,
  ...args: TArgs
): EngineState<TState> {
  if (!engine.started)
    throw new Error("Cannot perform action: machine not started");
  return {
    ...engine,
    state: action(engine.state, ...args),
  };
}

export function getCurrentState<TState>(engine: EngineState<TState>): string[] {
  return [...engine.machineStack].reverse().map((m) => m.currentState);
}

export function getMachineCurrentState<TState>(
  engine: EngineState<TState>,
  machineId: string,
): string | undefined {
  const machine = engine.machineStack.find((m) => m.config.id === machineId);
  if (!machine) return;

  return machine.currentState;
}

export class StateMachineEngine<TState> {
  private config: StateMachineConfig<TState>;
  private engineState: EngineState<TState>;

  public get machineStack(): readonly MachineRuntimeState<TState>[] {
    return this.engineState.machineStack;
  }
  public get state(): TState {
    return this.engineState.state;
  }
  public get currentState(): string[] {
    return getCurrentState(this.engineState);
  }

  constructor(config: StateMachineConfig<TState>, initialState: TState) {
    this.config = config;
    this.engineState = createEngine(initialState);
  }

  public start() {
    this.engineState = start(this.engineState, this.config);
  }

  public advance() {
    this.engineState = advance(this.engineState);
  }

  public doAction<TArgs extends unknown[]>(
    action: ActionFn<TState, TArgs>,
    ...args: TArgs
  ) {
    this.engineState = doAction(this.engineState, action, ...args);
  }

  public getCurrentStateForMachine(machineId: string) {
    return getMachineCurrentState(this.engineState, machineId);
  }
}
