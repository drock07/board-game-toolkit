import type { StateMachineConfig } from "@drock07/board-game-toolkit-core/state-machine";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  StateMachineContext,
  useGameEvent,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineEngineState,
  useStateMachineState,
  type StateMachineErrorHandler,
} from "./StateMachineContext.js";

interface TestState {
  log: string[];
}

type TestCommand = { type: "add"; value: string } | { type: "fail" };

type TestEvents = {
  ask: (data: { question: string }) => string;
  ping: (data: { n: number }) => void;
};

const initialState: TestState = { log: [] };

/** Two states: "a" accepts commands, then advances to "b". */
function makeConfig(
  onEnterB?: StateMachineConfig<
    TestState,
    TestCommand,
    TestEvents
  >["states"][string]["onEnter"],
): StateMachineConfig<TestState, TestCommand, TestEvents> {
  return {
    id: "test",
    initial: "a",
    onEnter: (state) => ({ ...state, log: [...state.log, "start"] }),
    states: {
      a: {
        actions: {
          add: {
            execute: (state, cmd) => ({ log: [...state.log, cmd.value] }),
          },
          fail: {
            validate: () => false,
            execute: (state) => state,
          },
        },
        getNext: () => "b",
      },
      b: { onEnter: onEnterB, getNext: () => null },
    },
  };
}

function renderMachine({
  config = makeConfig(),
  autostart = false,
  onError = vi.fn<StateMachineErrorHandler>(),
  strict = false,
}: {
  config?: StateMachineConfig<TestState, TestCommand, TestEvents>;
  autostart?: boolean;
  onError?: StateMachineErrorHandler;
  strict?: boolean;
} = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StateMachineContext
      config={config}
      initialState={initialState}
      autostart={autostart}
      onError={onError}
    >
      {children}
    </StateMachineContext>
  );
  const view = renderHook(
    () => ({
      actions: useStateMachineActions<TestState, TestCommand>(),
      state: useStateMachineState<TestState>(),
      current: useStateMachineCurrentState<TestState>(),
      engine: useStateMachineEngineState<TestState>(),
    }),
    // Root-level StrictMode; a nested <StrictMode> doesn't double-invoke effects here
    { wrapper, reactStrictMode: strict },
  );
  return { ...view, onError };
}

describe("StateMachineContext", () => {
  it("runs queued operations in order, each on the previous result", async () => {
    const { result } = renderMachine();

    let results: boolean[] = [];
    await act(async () => {
      const { start, dispatch, advance } = result.current.actions;
      results = await Promise.all([
        start(),
        dispatch({ type: "add", value: "x" }),
        dispatch({ type: "add", value: "y" }),
        advance(),
      ]);
    });

    expect(results).toEqual([true, true, true, true]);
    expect(result.current.state.log).toEqual(["start", "x", "y"]);
    expect(result.current.current).toEqual(["b"]);
  });

  it("reports a failed operation and cancels operations queued behind it", async () => {
    const { result, onError } = renderMachine();
    await act(() => result.current.actions.start());

    let results: boolean[] = [];
    await act(async () => {
      const { dispatch, advance } = result.current.actions;
      // The pattern the examples use: an illegal move must not end the turn
      results = await Promise.all([dispatch({ type: "fail" }), advance()]);
    });

    expect(results).toEqual([false, false]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "dispatch");
    expect(result.current.current).toEqual(["a"]);
    expect(result.current.engine.transitioning).toBe(false);

    // Operations queued after the failure run normally
    await act(async () => {
      expect(await result.current.actions.advance()).toBe(true);
    });
    expect(result.current.current).toEqual(["b"]);
  });

  it("autostarts once under StrictMode", async () => {
    const { result, onError } = renderMachine({
      autostart: true,
      strict: true,
    });

    await waitFor(() => expect(result.current.engine.started).toBe(true));
    // Flush the queue so a duplicate start, if any, has run and failed
    await act(() => result.current.actions.advance());

    expect(result.current.state.log).toEqual(["start"]);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("useGameEvent", () => {
  it("round-trips a declarative event and reports transitioning meanwhile", async () => {
    const config = makeConfig(async (state, _data, { emit }) => {
      const answer = await emit({ type: "ask", question: "color?" });
      return { log: [...state.log, `answer:${answer}`] };
    });
    const combined = renderHook(
      () => ({
        ask: useGameEvent<TestEvents, "ask">("ask"),
        actions: useStateMachineActions<TestState, TestCommand>(),
        engine: useStateMachineEngineState<TestState>(),
        state: useStateMachineState<TestState>(),
      }),
      {
        wrapper: ({ children }) => (
          <StateMachineContext
            config={config}
            initialState={initialState}
            onError={vi.fn()}
          >
            {children}
          </StateMachineContext>
        ),
      },
    );

    await act(() => combined.result.current.actions.start());
    let advanced: Promise<boolean> = Promise.resolve(false);
    act(() => {
      advanced = combined.result.current.actions.advance();
    });

    await waitFor(() =>
      expect(combined.result.current.ask.isEventActive).toBe(true),
    );
    expect(combined.result.current.ask.eventData).toEqual({
      question: "color?",
    });
    expect(combined.result.current.engine.transitioning).toBe(true);

    await act(async () => {
      combined.result.current.ask.respond("red");
      expect(await advanced).toBe(true);
    });

    expect(combined.result.current.ask.isEventActive).toBe(false);
    expect(combined.result.current.engine.transitioning).toBe(false);
    expect(combined.result.current.state.log).toEqual(["start", "answer:red"]);
  });

  it("calls every handler registered for an event type", async () => {
    const config = makeConfig(async (state, _data, { emit }) => {
      await emit({ type: "ping", n: 1 });
      return state;
    });
    const first = vi.fn();
    const second = vi.fn();

    const { result, unmount } = renderHook(
      () => {
        useGameEvent<TestEvents, "ping">("ping", first);
        useGameEvent<TestEvents, "ping">("ping", second);
        return useStateMachineActions<TestState, TestCommand>();
      },
      {
        wrapper: ({ children }) => (
          <StateMachineContext
            config={config}
            initialState={initialState}
            onError={vi.fn()}
          >
            {children}
          </StateMachineContext>
        ),
      },
    );

    await act(async () => {
      await result.current.start();
      await result.current.advance();
    });

    expect(first).toHaveBeenCalledWith({ n: 1 });
    expect(second).toHaveBeenCalledWith({ n: 1 });
    unmount();
  });
});
