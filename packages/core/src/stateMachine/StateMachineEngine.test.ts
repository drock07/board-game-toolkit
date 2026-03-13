import { describe, expect, it } from "vitest";
import { EmitHandler, StateMachineConfig } from "./StateMachineConfig";
import {
  advance,
  canDispatch,
  createEngine,
  dispatch,
  start,
  StateMachineEngine,
} from "./StateMachineEngine";

interface TestState {
  count: number;
  log: string[];
}

type TestCommand =
  | { type: "increment"; amount: number }
  | { type: "set"; value: number }
  | { type: "noop" };

const initialState: TestState = { count: 0, log: [] };

function makeConfig(
  overrides: Partial<StateMachineConfig<TestState, TestCommand>> = {},
): StateMachineConfig<TestState, TestCommand> {
  return {
    id: "test",
    initial: "a",
    states: {
      a: { getNext: () => "b" },
      b: { getNext: () => null },
    },
    ...overrides,
  };
}

describe("start", () => {
  it("initializes engine with the machine on the stack", async () => {
    const config = makeConfig();
    const engine = await start(createEngine(initialState), config);

    expect(engine.machineStack).toHaveLength(1);
    expect(engine.machineStack[0].currentState).toBe("a");
    expect(engine.state).toEqual(initialState);
  });

  it("calls onEnter for the machine when starting", async () => {
    const config = makeConfig({
      onEnter: (state) => ({ ...state, log: [...state.log, "machine:enter"] }),
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.state.log).toContain("machine:enter");
  });

  it("calls onEnter for the initial state", async () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: (state) => ({ ...state, log: [...state.log, "a:enter"] }),
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.state.log).toContain("a:enter");
  });

  it("calls machine onEnter before state onEnter", async () => {
    const config = makeConfig({
      onEnter: (state) => ({ ...state, log: [...state.log, "machine:enter"] }),
      states: {
        a: {
          onEnter: (state) => ({ ...state, log: [...state.log, "a:enter"] }),
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.state.log).toEqual(["machine:enter", "a:enter"]);
  });
});

describe("advance", () => {
  it("transitions to the next state", async () => {
    const config = makeConfig();
    const engine = await start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("a");

    const next = await advance(engine);

    expect(next.machineStack[0].currentState).toBe("b");
  });

  it("calls onExit for the current state and onEnter for the next", async () => {
    const config = makeConfig({
      states: {
        a: {
          onExit: (state) => ({ ...state, log: [...state.log, "a:exit"] }),
          getNext: () => "b",
        },
        b: {
          onEnter: (state) => ({ ...state, log: [...state.log, "b:enter"] }),
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await advance(engine);

    expect(next.state.log).toEqual(["a:exit", "b:enter"]);
  });

  it("calls getNext before onExit", async () => {
    const config = makeConfig({
      states: {
        a: {
          onExit: (state) => ({ ...state, count: state.count + 1 }),
          getNext: (state) => (state.count === 0 ? "b" : "c"),
        },
        b: {
          onEnter: (state) => ({ ...state, log: [...state.log, "b:enter"] }),
          getNext: () => null,
        },
        c: {
          onEnter: (state) => ({ ...state, log: [...state.log, "c:enter"] }),
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);

    // getNext sees count=0, routes to "b"; then onExit increments to 1
    const next = await advance(engine);

    expect(next.machineStack[0].currentState).toBe("b");
    expect(next.state.count).toBe(1);
  });

  it("pops machine from stack when final state returns null", async () => {
    const config = makeConfig({
      states: {
        a: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await advance(engine);

    expect(next.machineStack).toHaveLength(0);
  });

  it("calls machine onExit when machine completes", async () => {
    const config = makeConfig({
      onExit: (state) => ({ ...state, log: [...state.log, "machine:exit"] }),
      states: {
        a: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await advance(engine);

    expect(next.state.log).toContain("machine:exit");
  });

  it("throws when no active machine", async () => {
    const engine = createEngine(initialState);
    await expect(advance(engine)).rejects.toThrow(
      "Cannot advance: no active machine",
    );
  });

  it("modifies state through callbacks", async () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: (state) => ({ ...state, count: state.count + 1 }),
          getNext: () => "b",
        },
        b: {
          onEnter: (state) => ({ ...state, count: state.count + 10 }),
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.state.count).toBe(1);

    const next = await advance(engine);

    expect(next.state.count).toBe(11);
  });
});

describe("autoadvance", () => {
  it("automatically advances when autoadvance is true", async () => {
    const config = makeConfig({
      states: {
        a: {
          autoadvance: true,
          onEnter: (state) => ({ ...state, log: [...state.log, "a:enter"] }),
          getNext: () => "b",
        },
        b: {
          onEnter: (state) => ({ ...state, log: [...state.log, "b:enter"] }),
          getNext: () => null,
        },
      },
    });
    // start should auto-advance past 'a' into 'b'
    const engine = await start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("b");
    expect(engine.state.log).toEqual(["a:enter", "b:enter"]);
  });

  it("automatically advances when autoadvance function returns true", async () => {
    const config = makeConfig({
      states: {
        a: {
          autoadvance: (state) => state.count === 0,
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("b");
  });

  it("does not auto-advance when autoadvance function returns false", async () => {
    const config = makeConfig({
      states: {
        a: {
          autoadvance: (state) => state.count > 100,
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("a");
  });
});

describe("nested machines", () => {
  it("pushes nested machine onto the stack", async () => {
    const config = makeConfig({
      states: {
        a: {
          id: "nested",
          initial: "x",
          states: {
            x: { getNext: () => null },
          },
          getNext: () => null,
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(engine.machineStack).toHaveLength(2);
    expect(engine.machineStack[0].config.id).toBe("test");
    expect(engine.machineStack[1].config.id).toBe("nested");
    expect(engine.machineStack[1].currentState).toBe("x");
  });

  it("pops nested machine and advances parent when nested completes", async () => {
    const config = makeConfig({
      states: {
        a: {
          id: "nested",
          initial: "x",
          states: {
            x: { getNext: () => null },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    // nested machine is active at state x
    expect(engine.machineStack).toHaveLength(2);

    // advance completes nested, which pops it, then advances parent from a -> b
    const next = await advance(engine);

    expect(next.machineStack).toHaveLength(1);
    expect(next.machineStack[0].currentState).toBe("b");
  });

  it("calls lifecycle hooks in correct order for nested machines", async () => {
    const config: StateMachineConfig<TestState, TestCommand> = {
      id: "parent",
      initial: "a",
      states: {
        a: {
          id: "child",
          initial: "x",
          onEnter: (state) => ({
            ...state,
            log: [...state.log, "child:enter"],
          }),
          onExit: (state) => ({ ...state, log: [...state.log, "child:exit"] }),
          states: {
            x: {
              onEnter: (state) => ({
                ...state,
                log: [...state.log, "x:enter"],
              }),
              onExit: (state) => ({ ...state, log: [...state.log, "x:exit"] }),
              getNext: () => null,
            },
          },
          getNext: () => null,
        },
      },
    };
    const engine = await start(createEngine(initialState), config);

    expect(engine.state.log).toEqual(["child:enter", "x:enter"]);

    // advance: x exits, child completes and exits, parent completes
    const next = await advance(engine);

    expect(next.state.log).toEqual([
      "child:enter",
      "x:enter",
      "x:exit",
      "child:exit",
    ]);
  });
});

describe("immutability", () => {
  it("does not mutate the original engine state on advance", async () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: (state) => ({ ...state, count: 1 }),
          getNext: () => "b",
        },
        b: {
          onEnter: (state) => ({ ...state, count: 2 }),
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const snapshot = { ...engine, state: { ...engine.state } };

    await advance(engine);

    expect(engine.state.count).toBe(snapshot.state.count);
    expect(engine.machineStack).toEqual(snapshot.machineStack);
  });

  it("does not mutate the original state object", async () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: (state) => ({ ...state, count: 99 }),
          getNext: () => null,
        },
      },
    });
    const original: TestState = { count: 0, log: [] };
    await start(createEngine(original), config);

    expect(original.count).toBe(0);
    expect(original.log).toEqual([]);
  });
});

describe("dispatch", () => {
  it("applies the execute handler to the state", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 42 });

    expect(next.state.count).toBe(42);
  });

  it("passes the narrowed command type to execute", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            increment: {
              execute: (state, cmd) => ({
                ...state,
                count: state.count + cmd.amount,
              }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "increment", amount: 5 });

    expect(next.state.count).toBe(5);
  });

  it("throws when no handler for command type in current state", async () => {
    const config = makeConfig();
    const engine = await start(createEngine(initialState), config);

    await expect(dispatch(engine, { type: "set", value: 1 })).rejects.toThrow(
      "No handler for command 'set' in state 'a'",
    );
  });

  it("throws when validate returns false", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              validate: (_state, cmd) => cmd.value >= 0,
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    await expect(
      dispatch(engine, { type: "set", value: -1 }),
    ).rejects.toThrow("Command 'set' failed validation");
  });

  it("succeeds when validate returns true", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              validate: (_state, cmd) => cmd.value >= 0,
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 10 });

    expect(next.state.count).toBe(10);
  });

  it("records command in history", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const cmd1 = { type: "set" as const, value: 1 };
    const cmd2 = { type: "set" as const, value: 2 };
    const after1 = await dispatch(engine, cmd1);
    const after2 = await dispatch(after1, cmd2);

    expect(after1.history).toEqual([cmd1]);
    expect(after2.history).toEqual([cmd1, cmd2]);
  });

  it("throws when machine not started", async () => {
    const engine = createEngine<TestState, TestCommand>(initialState);

    await expect(dispatch(engine, { type: "noop" })).rejects.toThrow(
      "Cannot dispatch: machine not started",
    );
  });

  it("does not mutate the original engine state", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    await dispatch(engine, { type: "set", value: 99 });

    expect(engine.state.count).toBe(0);
    expect(engine.history).toEqual([]);
  });
});

describe("action-triggered transitions", () => {
  it("transitions to target state when execute returns transitionTo", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("b", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 42 });

    expect(next.state.count).toBe(42);
    expect(next.machineStack[0].currentState).toBe("b");
  });

  it("calls onExit for current state and onEnter for target state", async () => {
    const config = makeConfig({
      states: {
        a: {
          onExit: (state) => ({ ...state, log: [...state.log, "a:exit"] }),
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("b", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: {
          onEnter: (state) => ({ ...state, log: [...state.log, "b:enter"] }),
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 1 });

    expect(next.state.log).toEqual(["a:exit", "b:enter"]);
  });

  it("records command in history when transitioning", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("b", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 5 });

    expect(next.history).toEqual([{ type: "set", value: 5 }]);
  });

  it("throws when target state does not exist", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("nonexistent", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    await expect(
      dispatch(engine, { type: "set", value: 1 }),
    ).rejects.toThrow("triggered transition to 'nonexistent'");
  });

  it("handles autoadvance on the target state", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("b", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: {
          autoadvance: true,
          getNext: () => "c",
        },
        c: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 1 });

    expect(next.machineStack[0].currentState).toBe("c");
  });

  it("can transition to a nested machine state", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("nested", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        nested: {
          id: "nested",
          initial: "x",
          states: {
            x: { getNext: () => null },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 10 });

    expect(next.machineStack).toHaveLength(2);
    expect(next.machineStack[1].config.id).toBe("nested");
    expect(next.machineStack[1].currentState).toBe("x");
  });

  it("works without transition — backward compatible", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    const next = await dispatch(engine, { type: "set", value: 42 });

    expect(next.state.count).toBe(42);
    expect(next.machineStack[0].currentState).toBe("a");
  });
});

describe("transition data", () => {
  it("passes data from getNext tuple to onEnter", async () => {
    const config = makeConfig({
      states: {
        a: {
          getNext: (state): [string, unknown] => [
            "b",
            { result: state.count > 0 ? "win" : "lose" },
          ],
        },
        b: {
          onEnter: (state, data) => {
            const { result } = data as { result: string };
            return { ...state, log: [...state.log, `result:${result}`] };
          },
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await advance(engine);

    expect(next.state.log).toEqual(["result:lose"]);
  });

  it("passes data from action transitionTo to onEnter", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo(
                  "b",
                  { ...state, count: cmd.value },
                  { returnTo: "a" },
                ),
            },
          },
          getNext: () => "b",
        },
        b: {
          onEnter: (state, data) => {
            const { returnTo } = data as { returnTo: string };
            return { ...state, log: [...state.log, `returnTo:${returnTo}`] };
          },
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await dispatch(engine, { type: "set", value: 42 });

    expect(next.state.count).toBe(42);
    expect(next.state.log).toEqual(["returnTo:a"]);
  });

  it("passes data to nested machine onEnter", async () => {
    const config = makeConfig({
      states: {
        a: {
          getNext: (): [string, unknown] => ["nested", { fromA: true }],
        },
        nested: {
          id: "nested",
          initial: "x",
          onEnter: (state, data) => {
            const { fromA } = data as { fromA: boolean };
            return {
              ...state,
              log: [...state.log, `fromA:${fromA}`],
            };
          },
          states: {
            x: { getNext: () => null },
          },
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await advance(engine);

    expect(next.state.log).toEqual(["fromA:true"]);
  });

  it("data is undefined when getNext returns plain string", async () => {
    let receivedData: unknown = "sentinel";
    const config = makeConfig({
      states: {
        a: {
          getNext: () => "b",
        },
        b: {
          onEnter: (state, data) => {
            receivedData = data;
            return state;
          },
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    await advance(engine);

    expect(receivedData).toBeUndefined();
  });

  it("data is undefined when transitionTo called without data", async () => {
    let receivedData: unknown = "sentinel";
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd, { transitionTo }) =>
                transitionTo("b", { ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: {
          onEnter: (state, data) => {
            receivedData = data;
            return state;
          },
          getNext: () => null,
        },
      },
    });
    const engine = await start(createEngine(initialState), config);
    await dispatch(engine, { type: "set", value: 1 });

    expect(receivedData).toBeUndefined();
  });
});

describe("canDispatch", () => {
  it("returns true when handler exists and no validate", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(canDispatch(engine, { type: "set", value: 1 })).toBe(true);
  });

  it("returns true when validate passes", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              validate: (_state, cmd) => cmd.value >= 0,
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(canDispatch(engine, { type: "set", value: 5 })).toBe(true);
  });

  it("returns false when validate fails", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              validate: (_state, cmd) => cmd.value >= 0,
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);

    expect(canDispatch(engine, { type: "set", value: -1 })).toBe(false);
  });

  it("returns false when no handler exists", async () => {
    const config = makeConfig();
    const engine = await start(createEngine(initialState), config);

    expect(canDispatch(engine, { type: "set", value: 1 })).toBe(false);
  });

  it("returns false when machine not started", () => {
    const engine = createEngine<TestState, TestCommand>(initialState);

    expect(canDispatch(engine, { type: "noop" })).toBe(false);
  });

  it("returns false when engine is transitioning", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const transitioning = { ...engine, transitioning: true };

    expect(canDispatch(transitioning, { type: "set", value: 1 })).toBe(false);
  });
});

describe("transitioning", () => {
  it("transitioning is false after start completes", async () => {
    const config = makeConfig();
    const engine = await start(createEngine(initialState), config);

    expect(engine.transitioning).toBe(false);
  });

  it("transitioning is false after advance completes", async () => {
    const config = makeConfig();
    const engine = await start(createEngine(initialState), config);
    const next = await advance(engine);

    expect(next.transitioning).toBe(false);
  });

  it("transitioning is false after dispatch completes", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const next = await dispatch(engine, { type: "set", value: 1 });

    expect(next.transitioning).toBe(false);
  });

  it("rejects dispatch while transitioning", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config);
    const transitioning = { ...engine, transitioning: true };

    await expect(
      dispatch(transitioning, { type: "set", value: 1 }),
    ).rejects.toThrow("Cannot dispatch: engine is transitioning");
  });
});

describe("StateMachineEngine class", () => {
  it("throws when start is called twice", async () => {
    const config = makeConfig();
    const engine = new StateMachineEngine(config, initialState);

    await engine.start();

    await expect(engine.start()).rejects.toThrow(
      "Cannot start: machine already started",
    );
  });

  it("throws when advance is called before start", async () => {
    const config = makeConfig();
    const engine = new StateMachineEngine(config, initialState);

    await expect(engine.advance()).rejects.toThrow(
      "Cannot advance: no active machine",
    );
  });

  it("dispatch applies the command to the state", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = new StateMachineEngine(config, initialState);
    await engine.start();

    await engine.dispatch({ type: "set", value: 7 });

    expect(engine.state.count).toBe(7);
  });

  it("dispatch records in history", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = new StateMachineEngine(config, initialState);
    await engine.start();

    await engine.dispatch({ type: "set", value: 7 });

    expect(engine.history).toEqual([{ type: "set", value: 7 }]);
  });

  it("canDispatch returns correct values", async () => {
    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              validate: (_state, cmd) => cmd.value >= 0,
              execute: (state, cmd) => ({ ...state, count: cmd.value }),
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = new StateMachineEngine(config, initialState);
    await engine.start();

    expect(engine.canDispatch({ type: "set", value: 5 })).toBe(true);
    expect(engine.canDispatch({ type: "set", value: -1 })).toBe(false);
    expect(engine.canDispatch({ type: "noop" })).toBe(false);
  });
});

describe("emit", () => {
  it("calls emit handler in onEnter and pauses until resolved", async () => {
    const events: string[] = [];
    const emitHandler: EmitHandler = async (event) => {
      events.push(`handled:${event.type}`);
    };

    const config = makeConfig({
      states: {
        a: {
          onEnter: async (state, _data, { emit }) => {
            await emit({ type: "entering" });
            return { ...state, log: [...state.log, "a:enter"] };
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config, emitHandler);

    expect(events).toEqual(["handled:entering"]);
    expect(engine.state.log).toContain("a:enter");
  });

  it("calls emit handler in onExit and pauses until resolved", async () => {
    const events: string[] = [];
    const emitHandler: EmitHandler = async (event) => {
      events.push(`handled:${event.type}`);
    };

    const config = makeConfig({
      states: {
        a: {
          onExit: async (state, { emit }) => {
            await emit({ type: "exiting" });
            return { ...state, log: [...state.log, "a:exit"] };
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config, emitHandler);
    const next = await advance(engine, emitHandler);

    expect(events).toEqual(["handled:exiting"]);
    expect(next.state.log).toContain("a:exit");
  });

  it("calls emit handler in execute and pauses until resolved", async () => {
    const events: string[] = [];
    const emitHandler: EmitHandler = async (event) => {
      events.push(`handled:${event.type}`);
    };

    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: async (state, cmd, { emit }) => {
                await emit({ type: "setting" });
                return { ...state, count: cmd.value };
              },
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config, emitHandler);
    const next = await dispatch(engine, { type: "set", value: 42 }, emitHandler);

    expect(events).toEqual(["handled:setting"]);
    expect(next.state.count).toBe(42);
  });

  it("returns value from emit handler", async () => {
    const emitHandler: EmitHandler = async (event) => {
      if (event.type === "choose") return "red";
      return undefined;
    };

    const config = makeConfig({
      states: {
        a: {
          actions: {
            set: {
              execute: async (state, _cmd, { emit }) => {
                const color = await emit({ type: "choose" });
                return {
                  ...state,
                  log: [...state.log, `chose:${color}`],
                };
              },
            },
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = await start(createEngine(initialState), config, emitHandler);
    const next = await dispatch(
      engine,
      { type: "set", value: 1 },
      emitHandler,
    );

    expect(next.state.log).toEqual(["chose:red"]);
  });

  it("resolves immediately when no handler is registered", async () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: async (state, _data, { emit }) => {
            await emit({ type: "no-handler-for-this" });
            return { ...state, log: [...state.log, "continued"] };
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    // No emitHandler provided
    const engine = await start(createEngine(initialState), config);

    expect(engine.state.log).toContain("continued");
  });

  it("handles multiple sequential emits in one lifecycle hook", async () => {
    const events: string[] = [];
    const emitHandler: EmitHandler = async (event) => {
      events.push(event.type);
    };

    const config = makeConfig({
      states: {
        a: {
          onEnter: async (state, _data, { emit }) => {
            await emit({ type: "first" });
            await emit({ type: "second" });
            await emit({ type: "third" });
            return state;
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    await start(createEngine(initialState), config, emitHandler);

    expect(events).toEqual(["first", "second", "third"]);
  });

  it("passes event data to handler", async () => {
    let receivedData: any = null;
    const emitHandler: EmitHandler = async (event) => {
      receivedData = event;
    };

    const config = makeConfig({
      states: {
        a: {
          onEnter: async (state, _data, { emit }) => {
            await emit({ type: "cardPlayed", cardId: "ace", from: "hand" });
            return state;
          },
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    await start(createEngine(initialState), config, emitHandler);

    expect(receivedData).toEqual({
      type: "cardPlayed",
      cardId: "ace",
      from: "hand",
    });
  });
});
