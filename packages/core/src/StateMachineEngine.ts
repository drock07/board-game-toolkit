import {
  ActionHandler,
  isMachine,
  StateConfig,
  StateMachineConfig,
} from "./types/StateMachineConfig";
import {
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
  const initial =
    typeof config.initial === "function"
      ? config.initial(state)
      : config.initial;
  if (!(initial in config.states)) {
    throw new Error(
      `Machine '${config.id}': initial state '${initial}' not found in states [${Object.keys(config.states).join(", ")}]`,
    );
  }
  const machineEntry: MachineRuntimeState<TState> = {
    config,
    currentState: initial,
  };
  const newEngine: EngineState<TState> = {
    ...engine,
    machineStack: [...engine.machineStack, machineEntry],
    state,
  };

  return transitionTo(newEngine, config.states[initial]);
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

  if (!(nextStateName in machine.config.states)) {
    throw new Error(
      `Machine '${machine.config.id}': getNext returned '${nextStateName}' from state '${machine.currentState}', but it was not found in states [${Object.keys(machine.config.states).join(", ")}]`,
    );
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
 * Finds the action handler for the given command type in the current leaf state.
 */
function findActionHandler<TState>(
  engine: EngineState<TState>,
  commandType: string,
): ActionHandler<TState, any> | undefined {
  const machine = peek(engine.machineStack);
  if (!machine) return undefined;

  const currentStateConfig = machine.config.states[machine.currentState];
  return currentStateConfig.actions?.[commandType];
}

/**
 *
 * "Public" methods
 *
 */

export function createEngine<TState, TCommand extends { type: string } = any>(
  initialState: TState,
): EngineState<TState, TCommand> {
  return {
    machineStack: [],
    state: initialState,
    started: false,
    history: [],
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

export function dispatch<TState, TCommand extends { type: string }>(
  engine: EngineState<TState, TCommand>,
  command: TCommand,
): EngineState<TState, TCommand> {
  if (!engine.started)
    throw new Error("Cannot dispatch: machine not started");

  const handler = findActionHandler(engine, command.type);
  if (!handler) {
    const machine = peek(engine.machineStack);
    const stateName = machine?.currentState ?? "unknown";
    throw new Error(
      `No handler for command '${command.type}' in state '${stateName}'`,
    );
  }

  if (handler.validate && !handler.validate(engine.state, command)) {
    throw new Error(
      `Command '${command.type}' failed validation in current state`,
    );
  }

  return {
    ...engine,
    state: handler.execute(engine.state, command),
    history: [...engine.history, command],
  };
}

export function canDispatch<TState, TCommand extends { type: string }>(
  engine: EngineState<TState, TCommand>,
  command: TCommand,
): boolean {
  if (!engine.started) return false;

  const handler = findActionHandler(engine, command.type);
  if (!handler) return false;

  if (handler.validate) return handler.validate(engine.state, command);

  return true;
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

export class StateMachineEngine<
  TState,
  TCommand extends { type: string } = any,
> {
  private config: StateMachineConfig<TState, TCommand>;
  private engineState: EngineState<TState, TCommand>;

  public get machineStack(): readonly MachineRuntimeState<TState, TCommand>[] {
    return this.engineState.machineStack;
  }
  public get state(): TState {
    return this.engineState.state;
  }
  public get currentState(): string[] {
    return getCurrentState(this.engineState);
  }
  public get history(): readonly TCommand[] {
    return this.engineState.history;
  }

  constructor(
    config: StateMachineConfig<TState, TCommand>,
    initialState: TState,
  ) {
    this.config = config;
    this.engineState = createEngine(initialState);
  }

  public start() {
    this.engineState = start(this.engineState, this.config);
  }

  public advance() {
    this.engineState = advance(this.engineState);
  }

  public dispatch(command: TCommand) {
    this.engineState = dispatch(this.engineState, command);
  }

  public canDispatch(command: TCommand): boolean {
    return canDispatch(this.engineState, command);
  }

  public getCurrentStateForMachine(machineId: string) {
    return getMachineCurrentState(this.engineState, machineId);
  }
}
