import {
  ActionHandler,
  createTransitionSignal,
  DefaultEventMap,
  EmitFn,
  EmitHandler,
  GetNextResult,
  isMachine,
  isTransitionSignal,
  LifecycleContext,
  StateConfig,
  StateMachineConfig,
} from "./StateMachineConfig";

/**
 * Runtime state of a single machine in the stack.
 * Tracks which machine config is active and the current state name.
 */
export interface MachineRuntimeState<
  TState = unknown,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> {
  config: StateMachineConfig<TState, TCommand, TEvents>;
  currentState: string;
}

/**
 * The full engine state: the machine stack plus the game state.
 */
export interface EngineState<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> {
  machineStack: MachineRuntimeState<TState, TCommand, TEvents>[];
  state: TState;
  started: boolean;
  transitioning: boolean;
  history: TCommand[];
}

function peek<TState>(
  stack: MachineRuntimeState<TState>[],
): MachineRuntimeState<TState> | undefined {
  if (stack.length === 0) return undefined;
  return stack[stack.length - 1];
}

/**
 * Parses the result of getNext into a target name and optional data.
 */
function parseGetNextResult(
  result: GetNextResult,
): { target: string; data?: unknown } | null {
  if (result === null) return null;
  if (Array.isArray(result)) {
    return { target: result[0], data: result[1] };
  }
  return { target: result };
}

/**
 * Creates an EmitFn that delegates to the provided handler, or resolves
 * immediately as a no-op if no handler is provided.
 */
function createEmitFn(handler?: EmitHandler): EmitFn {
  if (!handler) {
    return () => Promise.resolve(undefined as any);
  }
  return (event) => handler(event as any);
}

/**
 * Creates a LifecycleContext with the given emit function.
 */
function createLifecycleContext(emit: EmitFn): LifecycleContext {
  return { emit };
}

/**
 * Enters a state or machine. Handles onEnter, pushing machines onto the
 * stack, resolving initial states, and triggering autoadvance.
 */
async function enterState<TState>(
  engine: EngineState<TState>,
  stateConfig: StateConfig<TState> | StateMachineConfig<TState>,
  emit: EmitFn,
  data?: unknown,
): Promise<EngineState<TState>> {
  const ctx = createLifecycleContext(emit);

  if (isMachine(stateConfig)) {
    const state = stateConfig.onEnter
      ? await stateConfig.onEnter(engine.state, data, ctx)
      : engine.state;
    const initial =
      typeof stateConfig.initial === "function"
        ? stateConfig.initial(state)
        : stateConfig.initial;
    if (!(initial in stateConfig.states)) {
      throw new Error(
        `Machine '${stateConfig.id}': initial state '${initial}' not found in states [${Object.keys(stateConfig.states).join(", ")}]`,
      );
    }
    const machineEntry: MachineRuntimeState<TState> = {
      config: stateConfig,
      currentState: initial,
    };
    const newEngine: EngineState<TState> = {
      ...engine,
      machineStack: [...engine.machineStack, machineEntry],
      state,
    };
    // Enter the initial state (no transition data for initial sub-states)
    return enterState(newEngine, stateConfig.states[initial], emit);
  }

  // Simple state
  const state = stateConfig.onEnter
    ? await stateConfig.onEnter(engine.state, data, ctx)
    : engine.state;
  const newEngine = { ...engine, state };

  const shouldAutoAdvance =
    typeof stateConfig.autoadvance === "function"
      ? stateConfig.autoadvance(state)
      : stateConfig.autoadvance;

  if (shouldAutoAdvance) {
    return resolveNext(newEngine, emit);
  }

  return newEngine;
}

/**
 * The "leave" flow: resolves getNext for routing, calls onExit, then
 * either enters the target state or pops the machine and recurses on
 * the parent.
 */
async function resolveNext<TState>(
  engine: EngineState<TState>,
  emit: EmitFn,
): Promise<EngineState<TState>> {
  const { machineStack } = engine;
  const machine = peek(machineStack)!;
  const currentStateConfig = machine.config.states[machine.currentState];
  const ctx = createLifecycleContext(emit);

  // 1. Route: determine where to go
  const rawNext = currentStateConfig.getNext?.(engine.state) ?? null;
  const parsed = parseGetNextResult(rawNext);

  // 2. Exit: run onExit after routing decision
  const exitState = currentStateConfig.onExit
    ? await currentStateConfig.onExit(engine.state, ctx)
    : engine.state;

  if (parsed === null) {
    // Machine complete — pop stack
    const newStack = machineStack.slice(0, -1);

    // Call the machine's own onExit (distinct from the leaf state's onExit
    // which already ran above). When this machine is nested, the parent's
    // resolveNext will call onExit on its state entry (which is this machine
    // config), so we only call it here for the top-level machine.
    const machineExitState =
      newStack.length === 0 && machine.config.onExit
        ? await machine.config.onExit(exitState, ctx)
        : exitState;

    const newEngine: EngineState<TState> = {
      ...engine,
      machineStack: newStack,
      state: machineExitState,
    };

    if (newStack.length > 0) {
      return resolveNext(newEngine, emit);
    }
    // Top-level machine completed
    return newEngine;
  }

  // 3. Transition to target state
  const { target: nextStateName, data } = parsed;

  if (!(nextStateName in machine.config.states)) {
    throw new Error(
      `Machine '${machine.config.id}': getNext returned '${nextStateName}' from state '${machine.currentState}', but it was not found in states [${Object.keys(machine.config.states).join(", ")}]`,
    );
  }

  const updatedMachine: MachineRuntimeState<TState> = {
    ...machine,
    currentState: nextStateName,
  };
  const newEngine: EngineState<TState> = {
    ...engine,
    machineStack: [...machineStack.slice(0, -1), updatedMachine],
    state: exitState,
  };

  return enterState(
    newEngine,
    machine.config.states[nextStateName],
    emit,
    data,
  );
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

export function createEngine<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
>(initialState: TState): EngineState<TState, TCommand, TEvents> {
  return {
    machineStack: [],
    state: initialState,
    started: false,
    transitioning: false,
    history: [],
  };
}

export async function start<TState>(
  engine: EngineState<TState>,
  config: StateMachineConfig<TState>,
  emitHandler?: EmitHandler,
): Promise<EngineState<TState>> {
  if (engine.started) throw new Error("Cannot start: machine already started");
  const emit = createEmitFn(emitHandler);
  const result = await enterState(
    {
      ...engine,
      started: true,
      transitioning: true,
    },
    config,
    emit,
  );
  return { ...result, transitioning: false };
}

export async function advance<TState>(
  engine: EngineState<TState>,
  emitHandler?: EmitHandler,
): Promise<EngineState<TState>> {
  const { machineStack } = engine;
  if (machineStack.length === 0)
    throw new Error("Cannot advance: no active machine");

  const emit = createEmitFn(emitHandler);
  const result = await resolveNext(
    { ...engine, transitioning: true },
    emit,
  );
  return { ...result, transitioning: false };
}

export async function dispatch<TState, TCommand extends { type: string }>(
  engine: EngineState<TState, TCommand>,
  command: TCommand,
  emitHandler?: EmitHandler,
): Promise<EngineState<TState, TCommand>> {
  if (!engine.started) throw new Error("Cannot dispatch: machine not started");
  if (engine.transitioning)
    throw new Error("Cannot dispatch: engine is transitioning");

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

  const emit = createEmitFn(emitHandler);
  const result = await handler.execute(engine.state, command, {
    transitionTo: createTransitionSignal,
    emit,
  });

  const newHistory = [...engine.history, command];

  if (isTransitionSignal(result)) {
    const { machineStack } = engine;
    const machine = peek(machineStack)!;
    const targetName = result.target;

    if (!(targetName in machine.config.states)) {
      throw new Error(
        `Machine '${machine.config.id}': action '${command.type}' triggered transition to '${targetName}', but it was not found in states [${Object.keys(machine.config.states).join(", ")}]`,
      );
    }

    // Exit current state
    const currentStateConfig = machine.config.states[machine.currentState];
    const ctx = createLifecycleContext(emit);
    const exitState = currentStateConfig.onExit
      ? await currentStateConfig.onExit(result.state, ctx)
      : result.state;

    // Update machine to point at the target state
    const updatedMachine: MachineRuntimeState<TState> = {
      ...machine,
      currentState: targetName,
    };
    const newEngine: EngineState<TState, TCommand> = {
      ...engine,
      machineStack: [...machineStack.slice(0, -1), updatedMachine],
      state: exitState,
      transitioning: true,
      history: newHistory,
    };

    // Enter the target state (handles onEnter, autoadvance, nested machines)
    const entered = await enterState(
      newEngine,
      machine.config.states[targetName],
      emit,
      result.data,
    );
    return { ...entered, transitioning: false };
  }

  return {
    ...engine,
    state: result,
    history: newHistory,
  };
}

export function canDispatch<TState, TCommand extends { type: string }>(
  engine: EngineState<TState, TCommand>,
  command: TCommand,
): boolean {
  if (!engine.started) return false;
  if (engine.transitioning) return false;

  const handler = findActionHandler(engine, command.type);
  if (!handler) return false;

  if (handler.validate) return handler.validate(engine.state, command);

  return true;
}

export function getCurrentState<TState>(engine: EngineState<TState>): string[] {
  return engine.machineStack.map((m) => m.currentState);
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
  TEvents = DefaultEventMap,
> {
  private config: StateMachineConfig<TState, TCommand, TEvents>;
  private engineState: EngineState<TState, TCommand, TEvents>;
  private emitHandler?: EmitHandler;

  public get machineStack(): readonly MachineRuntimeState<
    TState,
    TCommand,
    TEvents
  >[] {
    return this.engineState.machineStack;
  }
  public get state(): TState {
    return this.engineState.state;
  }
  public get currentState(): string[] {
    return getCurrentState(this.engineState as EngineState<TState>);
  }
  public get history(): readonly TCommand[] {
    return this.engineState.history;
  }
  public get transitioning(): boolean {
    return this.engineState.transitioning;
  }

  constructor(
    config: StateMachineConfig<TState, TCommand, TEvents>,
    initialState: TState,
    emitHandler?: EmitHandler,
  ) {
    this.config = config;
    this.engineState = createEngine(initialState);
    this.emitHandler = emitHandler;
  }

  public async start() {
    type E = EngineState<TState, TCommand, TEvents>;
    this.engineState = (await start(
      this.engineState as EngineState<TState>,
      this.config as StateMachineConfig<TState>,
      this.emitHandler,
    )) as E;
  }

  public async advance() {
    type E = EngineState<TState, TCommand, TEvents>;
    this.engineState = (await advance(
      this.engineState as EngineState<TState>,
      this.emitHandler,
    )) as E;
  }

  public async dispatch(command: TCommand) {
    type E = EngineState<TState, TCommand, TEvents>;
    this.engineState = (await dispatch(
      this.engineState as EngineState<TState, TCommand>,
      command,
      this.emitHandler,
    )) as E;
  }

  public canDispatch(command: TCommand): boolean {
    return canDispatch(
      this.engineState as EngineState<TState, TCommand>,
      command,
    );
  }

  public getCurrentStateForMachine(machineId: string) {
    return getMachineCurrentState(
      this.engineState as EngineState<TState>,
      machineId,
    );
  }
}
