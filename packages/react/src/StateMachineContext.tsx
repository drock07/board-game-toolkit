import {
  ActionFn,
  createEngine,
  EngineState,
  getCurrentState,
  getMachineCurrentState,
  StateMachineConfig,
  advance as toolkitAdvance,
  doAction as toolkitDoAction,
  start as toolkitStart,
} from "@drock07/board-game-toolkit-core";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

export interface StateMachineContextValue<TState> {
  engine: EngineState<TState>;
  start: () => void;
  advance: () => void;
  doAction: <TArgs extends unknown[]>(
    action: ActionFn<TState, TArgs>,
    ...args: TArgs
  ) => void;
}

const Context = createContext<StateMachineContextValue<any> | null>(null);

export interface StateMachineContextProps<TState> {
  config: StateMachineConfig<TState>;
  initialState: TState;
  children?: ReactNode;
}
export function StateMachineContext<TState>({
  config,
  initialState,
  children,
}: StateMachineContextProps<TState>) {
  const [engine, setEngine] = useState(() => createEngine(initialState));

  const start = useCallback(() => {
    setEngine((e) => toolkitStart(e, config));
  }, [config]);

  const advance = useCallback(() => {
    setEngine((e) => toolkitAdvance(e));
  }, []);

  const doAction = useCallback<
    <TArgs extends unknown[]>(
      action: ActionFn<TState, TArgs>,
      ...args: TArgs
    ) => void
  >((action, ...args) => {
    setEngine((e) => toolkitDoAction(e, action, ...args));
  }, []);

  return (
    <Context value={{ engine, start, advance, doAction }}>{children}</Context>
  );
}

function useStateMachine<TState>() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStateMachine must be used within a provider");
  return ctx as StateMachineContextValue<TState>;
}

export function useStateMachineEngineState<TState>() {
  const engine = useStateMachine<TState>().engine;
  return {
    started: engine.started,
    currentState: getCurrentState(engine),
  };
}

export function useStateMachineCurrentState<TState>(): string[];
export function useStateMachineCurrentState<TState>(
  machineId: string,
): string | undefined;
export function useStateMachineCurrentState<TState>(machineId?: string) {
  const engine = useStateMachine<TState>().engine;
  if (machineId) {
    return getMachineCurrentState(engine, machineId);
  } else {
    return getCurrentState(engine);
  }
}

export function useStateMachineState<TState>() {
  return useStateMachine<TState>().engine.state;
}

export function useStateMachineActions<TState>() {
  const { start, advance, doAction } = useStateMachine<TState>();
  return { start, advance, doAction };
}

export function createBoundActionHook<TState, TArgs extends unknown[]>(
  action: ActionFn<TState, TArgs>,
) {
  return () => {
    const { doAction } = useStateMachine<TState>();
    return useCallback(
      (...args: TArgs) => {
        doAction(action, ...args);
      },
      [doAction],
    );
  };
}
