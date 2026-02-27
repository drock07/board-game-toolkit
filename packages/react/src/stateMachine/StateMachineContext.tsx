import {
  EngineState,
  StateMachine,
  StateMachineConfig,
} from "@drock07/board-game-toolkit-core";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface StateMachineContextValue<
  TState,
  TCommand extends { type: string } = any,
> {
  engine: EngineState<TState, TCommand>;
  start: () => void;
  advance: () => void;
  dispatch: (command: TCommand) => void;
  canDispatch: (command: TCommand) => boolean;
}

const Context = createContext<StateMachineContextValue<any, any> | null>(null);

export interface StateMachineContextProps<
  TState,
  TCommand extends { type: string } = any,
> {
  config: StateMachineConfig<TState, TCommand>;
  initialState: TState;
  autostart?: boolean;
  children?: ReactNode;
}
export function StateMachineContext<
  TState,
  TCommand extends { type: string } = any,
>({
  config,
  initialState,
  autostart = false,
  children,
}: StateMachineContextProps<TState, TCommand>) {
  const [engine, setEngine] = useState(() =>
    StateMachine.createEngine<TState, TCommand>(initialState),
  );

  const start = useCallback(() => {
    setEngine((e) => (e.started ? e : StateMachine.start(e, config)));
  }, [config]);

  const advance = useCallback(() => {
    setEngine((e) => StateMachine.advance(e));
  }, []);

  const dispatchCommand = useCallback((command: TCommand) => {
    setEngine((e) => StateMachine.dispatch(e, command));
  }, []);

  const canDispatchCommand = useCallback(
    (command: TCommand) => {
      return StateMachine.canDispatch(engine, command);
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
        advance,
        dispatch: dispatchCommand,
        canDispatch: canDispatchCommand,
      }}
    >
      {children}
    </Context>
  );
}

function useStateMachine<TState, TCommand extends { type: string } = any>() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStateMachine must be used within a provider");
  return ctx as StateMachineContextValue<TState, TCommand>;
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

export function withStateMachineContext<
  TState,
  TCommand extends { type: string } = any,
>(
  component: React.FC,
  config: StateMachineConfig<TState, TCommand>,
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
