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
  useRef,
  useState,
} from "react";

export interface StateMachineContextValue<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> {
  engine: EngineState<TState, TCommand, TEvents>;
  start: () => void;
  advance: () => void;
  dispatch: (command: TCommand) => void;
  canDispatch: (command: TCommand) => boolean;
  transitioning: boolean;
  /** @internal Used by useGameEvent to register handlers */
  _registerEventHandler: (
    type: string,
    handler: (data: any) => any,
  ) => () => void;
}

const Context = createContext<StateMachineContextValue<any, any, any> | null>(
  null,
);

export interface StateMachineContextProps<
  TState,
  TCommand extends { type: string } = any,
  TEvents = DefaultEventMap,
> {
  config: StateMachineConfig<TState, TCommand, TEvents>;
  initialState: TState;
  autostart?: boolean;
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
  children,
}: StateMachineContextProps<TState, TCommand, TEvents>) {
  type Engine = EngineState<TState, TCommand, TEvents>;

  const [engine, setEngine] = useState<Engine>(
    () => StateMachine.createEngine<TState, TCommand, TEvents>(initialState),
  );

  // Ref-based engine state — always holds the latest state, used by the
  // operation queue so each operation reads post-previous-operation state.
  const engineRef = useRef<Engine>(engine);

  // Serialized operation queue — each operation awaits the previous one,
  // preventing race conditions when dispatch+advance are called in sequence.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  // Event handler registry — ref-based so handlers are always current
  const eventHandlersRef = useRef<Map<string, (data: any) => any>>(new Map());

  const emitHandler = useCallback<EmitHandler>(async (event) => {
    const handler = eventHandlersRef.current.get(event.type as string);
    if (!handler) return undefined;
    const { type: _, ...data } = event;
    return handler(data);
  }, []);

  const registerEventHandler = useCallback(
    (type: string, handler: (data: any) => any) => {
      eventHandlersRef.current.set(type, handler);
      return () => {
        eventHandlersRef.current.delete(type);
      };
    },
    [],
  );

  /**
   * Enqueues an async engine operation. Operations are serialized — each one
   * reads the latest engine state (after all previous operations have completed)
   * and writes the result back. This prevents race conditions between sequential
   * dispatch() and advance() calls.
   */
  const enqueue = useCallback(
    (
      operation: (
        engine: EngineState<TState>,
      ) => Promise<EngineState<TState>>,
    ) => {
      queueRef.current = queueRef.current.then(async () => {
        const current = engineRef.current;
        try {
          const result = (await operation(
            current as EngineState<TState>,
          )) as Engine;
          engineRef.current = result;
          setEngine(result);
        } catch {
          // On error (validation failure, etc), ensure transitioning is cleared
          // so the UI doesn't get stuck.
          const cleared = {
            ...engineRef.current,
            transitioning: false,
          };
          engineRef.current = cleared;
          setEngine(cleared);
        }
      });
    },
    [],
  );

  const start = useCallback(() => {
    enqueue((e) =>
      StateMachine.start(e, config as StateMachineConfig<TState>, emitHandler),
    );
  }, [config, emitHandler, enqueue]);

  const advanceFn = useCallback(() => {
    enqueue((e) => StateMachine.advance(e, emitHandler));
  }, [emitHandler, enqueue]);

  const dispatchCommand = useCallback(
    (command: TCommand) => {
      enqueue((e) =>
        StateMachine.dispatch(
          e as EngineState<TState, TCommand>,
          command,
          emitHandler,
        ),
      );
    },
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

  useEffect(() => {
    if (autostart) {
      start();
    }
  }, []);

  return (
    <Context
      value={{
        engine,
        start,
        advance: advanceFn,
        dispatch: dispatchCommand,
        canDispatch: canDispatchCommand,
        transitioning: engine.transitioning,
        _registerEventHandler: registerEventHandler,
      }}
    >
      {children}
    </Context>
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
    currentState: StateMachine.getCurrentState(engine),
  };
}

export function useStateMachineCurrentState<TState>(): string[];
export function useStateMachineCurrentState<TState>(
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
):
  | void
  | {
      isEventActive: boolean;
      eventData: EventData<TEvents, K> | null;
      eventId: number;
      respond: (value: EventResponse<TEvents, K>) => void;
    } {
  const { _registerEventHandler } = useStateMachine();

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
  const declarativeHandler = useCallback(
    (data: EventData<TEvents, K>) => {
      return new Promise<EventResponse<TEvents, K>>((resolve) => {
        resolverRef.current = resolve;
        setEventData(data);
        setEventId((prev) => prev + 1);
      });
    },
    [],
  );

  const activeHandler = handler ?? declarativeHandler;
  const handlerRef = useRef(activeHandler);
  handlerRef.current = activeHandler;

  useEffect(() => {
    const unregister = _registerEventHandler(type as string, (data: any) =>
      handlerRef.current(data),
    );
    return unregister;
  }, [type, _registerEventHandler]);

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
  },
) {
  const Component = component;
  return () => (
    <StateMachineContext
      config={config}
      initialState={initialState}
      autostart={options?.autostart ?? false}
    >
      <Component />
    </StateMachineContext>
  );
}
