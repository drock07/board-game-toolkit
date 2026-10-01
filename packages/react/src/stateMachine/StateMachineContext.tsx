import {
  DefaultEventMap,
  EmitHandler,
  EngineState,
  EventData,
  EventResponse,
  StateMachine,
  StateMachineConfig,
} from "@drock07/board-game-toolkit-core";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** The engine operations the provider runs. */
export type StateMachineOperation = "start" | "advance" | "dispatch";

/**
 * Called when an engine operation fails, e.g. a command fails validation or
 * a lifecycle hook throws. Defaults to logging with `console.error`.
 */
export type StateMachineErrorHandler = (
  error: unknown,
  operation: StateMachineOperation,
) => void;

/**
 * The result of `start`, `advance` or `dispatch`. Resolves `true` once the
 * operation has been applied, or `false` if it failed or was cancelled
 * because an operation queued before it failed. Never rejects: errors are
 * reported through `onError`, so it's safe not to await it.
 */
export interface OperationResult extends Promise<boolean> {
  /** Brand so lint configs can recognize this as a never-rejecting promise. */
  readonly __operationResult?: never;
}

export interface StateMachineContextValue<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> {
  engine: EngineState<TState, TCommand, TEvents>;
  start: () => OperationResult;
  advance: () => OperationResult;
  dispatch: (command: TCommand) => OperationResult;
  canDispatch: (command: TCommand) => boolean;
  /** True while an operation (including any `emit` it awaits) is in flight. */
  transitioning: boolean;
}

type EventHandler = (data: unknown) => unknown;

interface EventRegistry {
  register: (type: string, handler: EventHandler) => () => void;
}

const Context = createContext<StateMachineContextValue<any, any, any> | null>(
  null,
);

// Internal: lets useGameEvent register handlers without exposing the API
const EventRegistryContext = createContext<EventRegistry | null>(null);

const defaultOnError: StateMachineErrorHandler = (error, operation) => {
  console.error(`[board-game-toolkit] ${operation} failed:`, error);
};

export interface StateMachineContextProps<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> {
  config: StateMachineConfig<TState, TCommand, TEvents>;
  initialState: TState;
  autostart?: boolean;
  /** Called when an operation fails. Defaults to `console.error`. */
  onError?: StateMachineErrorHandler;
  children?: ReactNode;
}
export function StateMachineContext<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
>({
  config,
  initialState,
  autostart = false,
  onError = defaultOnError,
  children,
}: StateMachineContextProps<TState, TCommand, TEvents>) {
  type Engine = EngineState<TState, TCommand, TEvents>;

  const [engine, setEngine] = useState<Engine>(() =>
    StateMachine.createEngine<TState, TCommand, TEvents>(initialState),
  );

  // Ref-based engine state — always holds the latest settled state, used by
  // the operation queue so each operation reads post-previous-operation state.
  const engineRef = useRef<Engine>(engine);

  // Serialized operation queue — each operation awaits the previous one,
  // preventing race conditions when dispatch+advance are called in sequence.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Incremented on every failure. An operation queued before a failure sees a
  // different value when it runs and is cancelled, so `dispatch(); advance();`
  // doesn't advance after a rejected dispatch.
  const failureCountRef = useRef(0);

  const onErrorRef = useRef(onError);
  useLayoutEffect(() => {
    onErrorRef.current = onError;
  });

  // Event handler registry — any number of handlers per event type
  const eventHandlersRef = useRef(new Map<string, Set<EventHandler>>());

  const emitHandler = useCallback<EmitHandler>(async (event) => {
    const handlers = eventHandlersRef.current.get(event.type);
    if (!handlers || handlers.size === 0) return undefined;
    const { type: _, ...data } = event;
    // Wait for every handler (e.g. an animation and a sound), and respond with
    // the first value any of them returns.
    const results = await Promise.all([...handlers].map((h) => h(data)));
    return results.find((result) => result !== undefined);
  }, []);

  const eventRegistry = useMemo<EventRegistry>(
    () => ({
      register: (type, handler) => {
        const handlers = eventHandlersRef.current;
        let set = handlers.get(type);
        if (!set) {
          set = new Set();
          handlers.set(type, set);
        }
        set.add(handler);
        return () => {
          set.delete(handler);
          if (set.size === 0) handlers.delete(type);
        };
      },
    }),
    [],
  );

  /**
   * Enqueues an async engine operation. Operations are serialized — each one
   * reads the latest engine state (after all previous operations have completed)
   * and writes the result back. While it runs, the published engine state has
   * `transitioning: true`.
   */
  const enqueue = useCallback(
    (
      operation: StateMachineOperation,
      run: (engine: Engine) => Promise<Engine>,
    ): OperationResult => {
      const failuresWhenQueued = failureCountRef.current;
      const result = queueRef.current.then(async () => {
        if (failureCountRef.current !== failuresWhenQueued) return false;
        const current = engineRef.current;
        setEngine({ ...current, transitioning: true });
        try {
          const next = await run(current);
          engineRef.current = next;
          setEngine(next);
          return true;
        } catch (error) {
          failureCountRef.current++;
          setEngine(current);
          try {
            onErrorRef.current(error, operation);
          } catch (handlerError) {
            console.error(handlerError);
          }
          return false;
        }
      });
      queueRef.current = result;
      return result;
    },
    [],
  );

  const start = useCallback(
    () =>
      enqueue(
        "start",
        (e) =>
          StateMachine.start(
            e as EngineState<TState>,
            config as StateMachineConfig<TState>,
            emitHandler,
          ) as Promise<Engine>,
      ),
    [config, emitHandler, enqueue],
  );

  const advanceFn = useCallback(
    () =>
      enqueue(
        "advance",
        (e) =>
          StateMachine.advance(
            e as EngineState<TState>,
            emitHandler,
          ) as Promise<Engine>,
      ),
    [emitHandler, enqueue],
  );

  const dispatchCommand = useCallback(
    (command: TCommand) =>
      enqueue(
        "dispatch",
        (e) =>
          StateMachine.dispatch(
            e as EngineState<TState, TCommand>,
            command,
            emitHandler,
          ) as Promise<Engine>,
      ),
    [emitHandler, enqueue],
  );

  const canDispatchCommand = useCallback(
    (command: TCommand) => {
      return StateMachine.canDispatch(
        engine as EngineState<TState, TCommand>,
        command,
      );
    },
    [engine],
  );

  // Guarded so StrictMode's double-invoked effects don't start twice
  const autostartedRef = useRef(false);
  useEffect(() => {
    if (!autostart || autostartedRef.current) return;
    autostartedRef.current = true;
    void start();
  }, [autostart, start]);

  return (
    <EventRegistryContext value={eventRegistry}>
      <Context
        value={{
          engine,
          start,
          advance: advanceFn,
          dispatch: dispatchCommand,
          canDispatch: canDispatchCommand,
          transitioning: engine.transitioning,
        }}
      >
        {children}
      </Context>
    </EventRegistryContext>
  );
}

function useStateMachine<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
>() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStateMachine must be used within a provider");
  return ctx as StateMachineContextValue<TState, TCommand, TEvents>;
}

export function useStateMachineEngineState<TState>() {
  const engine = useStateMachine<TState>().engine;
  return {
    started: engine.started,
    transitioning: engine.transitioning,
    currentState: StateMachine.getCurrentState(engine),
  };
}

export function useStateMachineCurrentState<_TState>(): string[];
export function useStateMachineCurrentState<_TState>(
  machineId: string,
): string | undefined;
export function useStateMachineCurrentState<TState>(machineId?: string) {
  const engine = useStateMachine<TState>().engine;
  if (machineId) {
    return StateMachine.getMachineCurrentState(engine, machineId);
  } else {
    return StateMachine.getCurrentState(engine);
  }
}

export function useStateMachineState<TState>() {
  return useStateMachine<TState>().engine.state;
}

export function useStateMachineActions<
  TState,
  TCommand extends { type: string } = any,
>() {
  const { start, advance, dispatch, canDispatch } = useStateMachine<
    TState,
    TCommand
  >();
  return { start, advance, dispatch, canDispatch };
}

/**
 * Registers a handler for a specific game event type.
 * When the engine emits an event of this type, the handler is called
 * and the engine pauses until it resolves.
 *
 * Two forms:
 *
 * **Callback form** — handler runs when the event fires:
 * ```tsx
 * useGameEvent<MyEvents>("cardPlayed", (data) => { animate(data); });
 * ```
 *
 * **Declarative form** — returns a state bag for rendering:
 * ```tsx
 * const { isEventActive, eventData, respond } = useGameEvent<MyEvents>("chooseColor");
 * {isEventActive && <button onClick={() => respond("red")}>Red</button>}
 * ```
 */
// Overload: callback form
export function useGameEvent<
  TEvents = DefaultEventMap,
  K extends keyof TEvents = keyof TEvents,
>(
  type: K,
  handler: (
    data: EventData<TEvents, K>,
  ) => EventResponse<TEvents, K> | Promise<EventResponse<TEvents, K>>,
): void;
// Overload: declarative form
export function useGameEvent<
  TEvents = DefaultEventMap,
  K extends keyof TEvents = keyof TEvents,
>(
  type: K,
): {
  isEventActive: boolean;
  eventData: EventData<TEvents, K> | null;
  eventId: number;
  respond: (value: EventResponse<TEvents, K>) => void;
};
// Implementation
export function useGameEvent<
  TEvents = DefaultEventMap,
  K extends keyof TEvents = keyof TEvents,
>(
  type: K,
  handler?: (
    data: EventData<TEvents, K>,
  ) => EventResponse<TEvents, K> | Promise<EventResponse<TEvents, K>>,
): void | {
  isEventActive: boolean;
  eventData: EventData<TEvents, K> | null;
  eventId: number;
  respond: (value: EventResponse<TEvents, K>) => void;
} {
  const registry = useContext(EventRegistryContext);
  if (!registry) {
    throw new Error("useGameEvent must be used within a StateMachineContext");
  }

  // Declarative form state
  const [eventData, setEventData] = useState<EventData<TEvents, K> | null>(
    null,
  );
  const [eventId, setEventId] = useState(0);
  const resolverRef = useRef<
    ((value: EventResponse<TEvents, K>) => void) | null
  >(null);

  // Build the actual handler — either the user's callback or the promise-based one
  const isDeclarative = !handler;
  const declarativeHandler = useCallback((data: EventData<TEvents, K>) => {
    return new Promise<EventResponse<TEvents, K>>((resolve) => {
      resolverRef.current = resolve;
      setEventData(data);
      setEventId((prev) => prev + 1);
    });
  }, []);

  const activeHandler = handler ?? declarativeHandler;
  const handlerRef = useRef(activeHandler);
  useLayoutEffect(() => {
    handlerRef.current = activeHandler;
  });

  useEffect(
    () =>
      registry.register(type as string, (data) =>
        handlerRef.current(data as EventData<TEvents, K>),
      ),
    [type, registry],
  );

  const respond = useCallback((value: EventResponse<TEvents, K>) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setEventData(null);
  }, []);

  if (isDeclarative) {
    return {
      isEventActive: eventData !== null,
      eventData,
      eventId,
      respond,
    };
  }
}

export function withStateMachineContext<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
>(
  component: React.FC,
  config: StateMachineConfig<TState, TCommand, TEvents>,
  initialState: TState,
  options?: {
    autostart?: boolean;
    onError?: StateMachineErrorHandler;
  },
) {
  const Component = component;
  return () => (
    <StateMachineContext
      config={config}
      initialState={initialState}
      autostart={options?.autostart ?? false}
      onError={options?.onError}
    >
      <Component />
    </StateMachineContext>
  );
}
