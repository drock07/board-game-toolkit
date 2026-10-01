import { createRng, randomSeed, type SeededRng } from "../random/index.js";
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
} from "./StateMachineConfig.js";

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
 * One completed engine operation, with the responses its `emit` calls
 * received (in order). Together with the seed, the log reproduces a game.
 */
export type EngineLogEntry<TCommand extends { type: string } = any> = (
  | { op: "start" }
  | { op: "advance" }
  | { op: "dispatch"; command: TCommand }
) & { responses: unknown[] };

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
  /** The seed this engine's random source started from. */
  seed: number;
  /** The random source's current position. Advanced by each operation. */
  rngState: number;
  /** Every completed operation, in order. Replay it with {@link replay}. */
  log: EngineLogEntry<TCommand>[];
}

/** What each operation hands to the hooks it runs. */
interface Runtime {
  emit: EmitFn;
  rng: SeededRng;
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
 * Creates an EmitFn that delegates to the provided handler (or resolves
 * immediately with `undefined` if there is none), recording each response.
 */
function createEmitFn(
  handler: EmitHandler | undefined,
  responses: unknown[],
): EmitFn {
  return async (event) => {
    const response: unknown = handler ? await handler(event) : undefined;
    responses.push(response);
    return response as never;
  };
}

/**
 * Runs one engine operation with a fresh runtime, then stores the advanced
 * random state and appends the operation to the log.
 */
async function runOperation<TState, TCommand extends { type: string }>(
  engine: EngineState<TState, TCommand>,
  entry: DistributiveOmit<EngineLogEntry<TCommand>, "responses">,
  emitHandler: EmitHandler | undefined,
  run: (rt: Runtime) => Promise<EngineState<TState, TCommand>>,
): Promise<EngineState<TState, TCommand>> {
  const responses: unknown[] = [];
  const rt: Runtime = {
    emit: createEmitFn(emitHandler, responses),
    rng: createRng(engine.rngState),
  };
  const result = await run(rt);
  return {
    ...result,
    transitioning: false,
    rngState: rt.rng.state,
    log: [...engine.log, { ...entry, responses }],
  };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * Creates a LifecycleContext from the operation's runtime.
 */
function createLifecycleContext(rt: Runtime): LifecycleContext {
  return { emit: rt.emit, rng: rt.rng };
}

/**
 * Enters a state or machine. Handles onEnter, pushing machines onto the
 * stack, resolving initial states, and triggering autoadvance.
 */
async function enterState<TState>(
  engine: EngineState<TState>,
  stateConfig: StateConfig<TState> | StateMachineConfig<TState>,
  rt: Runtime,
  data?: unknown,
): Promise<EngineState<TState>> {
  const ctx = createLifecycleContext(rt);

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
    return enterState(newEngine, stateConfig.states[initial], rt);
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
    return resolveNext(newEngine, rt);
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
  rt: Runtime,
): Promise<EngineState<TState>> {
  const { machineStack } = engine;
  const machine = peek(machineStack)!;
  const currentStateConfig = machine.config.states[machine.currentState];
  const ctx = createLifecycleContext(rt);

  // 1. Route: determine where to go
  const rawNext =
    currentStateConfig.getNext?.(engine.state, { rng: rt.rng }) ?? null;
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
      return resolveNext(newEngine, rt);
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

  return enterState(newEngine, machine.config.states[nextStateName], rt, data);
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

/** Options for {@link createEngine}. */
export interface CreateEngineOptions {
  /**
   * Seed for the engine's random source. Defaults to a random seed, which is
   * recorded in `EngineState.seed` so the game can still be replayed.
   */
  seed?: number;
}

export function createEngine<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
>(
  initialState: TState,
  options: CreateEngineOptions = {},
): EngineState<TState, TCommand, TEvents> {
  const seed = (options.seed ?? randomSeed()) >>> 0;
  return {
    machineStack: [],
    state: initialState,
    started: false,
    transitioning: false,
    seed,
    rngState: seed,
    log: [],
  };
}

export async function start<TState>(
  engine: EngineState<TState>,
  config: StateMachineConfig<TState>,
  emitHandler?: EmitHandler,
): Promise<EngineState<TState>> {
  if (engine.started) throw new Error("Cannot start: machine already started");
  return runOperation(engine, { op: "start" }, emitHandler, (rt) =>
    enterState({ ...engine, started: true, transitioning: true }, config, rt),
  );
}

export async function advance<TState>(
  engine: EngineState<TState>,
  emitHandler?: EmitHandler,
): Promise<EngineState<TState>> {
  if (engine.machineStack.length === 0)
    throw new Error("Cannot advance: no active machine");

  return runOperation(engine, { op: "advance" }, emitHandler, (rt) =>
    resolveNext({ ...engine, transitioning: true }, rt),
  );
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

  return runOperation(
    engine,
    { op: "dispatch", command },
    emitHandler,
    async (rt) => {
      const result = await handler.execute(engine.state, command, {
        transitionTo: createTransitionSignal,
        emit: rt.emit,
        rng: rt.rng,
      });

      if (!isTransitionSignal(result)) {
        return { ...engine, state: result };
      }

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
      const exitState = currentStateConfig.onExit
        ? await currentStateConfig.onExit(
            result.state,
            createLifecycleContext(rt),
          )
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
      };

      // Enter the target state (handles onEnter, autoadvance, nested machines)
      return enterState(
        newEngine,
        machine.config.states[targetName],
        rt,
        result.data,
      ) as Promise<EngineState<TState, TCommand>>;
    },
  );
}

/**
 * Rebuilds a game from its seed and log by re-running every operation, with
 * each `emit` answered by the response recorded at the time. Given the same
 * config and initial state, the result matches the original engine state.
 *
 * @throws If the replay diverges from the log (e.g. the config changed, so
 *   the number of `emit` calls no longer matches the recorded responses).
 */
export async function replay<TState, TCommand extends { type: string } = any>(
  config: StateMachineConfig<TState>,
  initialState: TState,
  recording: { seed: number; log: readonly EngineLogEntry<TCommand>[] },
): Promise<EngineState<TState, TCommand>> {
  let engine = createEngine<TState, TCommand>(initialState, {
    seed: recording.seed,
  });

  for (const [index, entry] of recording.log.entries()) {
    const pending = [...entry.responses];
    const emitHandler: EmitHandler = (event) => {
      if (pending.length === 0) {
        throw new Error(
          `Replay diverged at log entry ${index} (${entry.op}): unexpected emit '${event.type}'`,
        );
      }
      return Promise.resolve(pending.shift());
    };

    if (entry.op === "start") {
      engine = (await start(engine, config, emitHandler)) as typeof engine;
    } else if (entry.op === "advance") {
      engine = (await advance(engine, emitHandler)) as typeof engine;
    } else {
      engine = await dispatch(engine, entry.command, emitHandler);
    }

    if (pending.length > 0) {
      throw new Error(
        `Replay diverged at log entry ${index} (${entry.op}): ${pending.length} recorded emit response(s) were not used`,
      );
    }
  }

  return engine;
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
  public get seed(): number {
    return this.engineState.seed;
  }
  public get log(): readonly EngineLogEntry<TCommand>[] {
    return this.engineState.log;
  }
  public get transitioning(): boolean {
    return this.engineState.transitioning;
  }

  constructor(
    config: StateMachineConfig<TState, TCommand, TEvents>,
    initialState: TState,
    emitHandler?: EmitHandler,
    options?: CreateEngineOptions,
  ) {
    this.config = config;
    this.engineState = createEngine(initialState, options);
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

  public getMachineCurrentState(machineId: string) {
    return getMachineCurrentState(
      this.engineState as EngineState<TState>,
      machineId,
    );
  }
}
