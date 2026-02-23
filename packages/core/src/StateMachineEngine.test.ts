import { describe, it, expect } from "vitest";
import {
  createEngine,
  start,
  advance,
  doAction,
  StateMachineEngine,
} from "./StateMachineEngine";
import { StateMachineConfig } from "./types/StateMachineConfig";

interface TestState {
  count: number;
  log: string[];
}

const initialState: TestState = { count: 0, log: [] };

function makeConfig(
  overrides: Partial<StateMachineConfig<TestState>> = {},
): StateMachineConfig<TestState> {
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
  it("initializes engine with the machine on the stack", () => {
    const config = makeConfig();
    const engine = start(createEngine(initialState), config);

    expect(engine.machineStack).toHaveLength(1);
    expect(engine.machineStack[0].currentState).toBe("a");
    expect(engine.state).toEqual(initialState);
  });

  it("calls onEnter for the machine when starting", () => {
    const config = makeConfig({
      onEnter: (state) => ({ ...state, log: [...state.log, "machine:enter"] }),
    });
    const engine = start(createEngine(initialState), config);

    expect(engine.state.log).toContain("machine:enter");
  });

  it("calls onEnter for the initial state", () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: (state) => ({ ...state, log: [...state.log, "a:enter"] }),
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = start(createEngine(initialState), config);

    expect(engine.state.log).toContain("a:enter");
  });

  it("calls machine onEnter before state onEnter", () => {
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
    const engine = start(createEngine(initialState), config);

    expect(engine.state.log).toEqual(["machine:enter", "a:enter"]);
  });
});

describe("advance", () => {
  it("transitions to the next state", () => {
    const config = makeConfig();
    const engine = start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("a");

    const next = advance(engine);

    expect(next.machineStack[0].currentState).toBe("b");
  });

  it("calls onExit for the current state and onEnter for the next", () => {
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
    const engine = start(createEngine(initialState), config);
    const next = advance(engine);

    expect(next.state.log).toEqual(["a:exit", "b:enter"]);
  });

  it("pops machine from stack when final state returns null", () => {
    const config = makeConfig({
      states: {
        a: { getNext: () => null },
      },
    });
    const engine = start(createEngine(initialState), config);
    const next = advance(engine);

    expect(next.machineStack).toHaveLength(0);
  });

  it("calls machine onExit when machine completes", () => {
    const config = makeConfig({
      onExit: (state) => ({ ...state, log: [...state.log, "machine:exit"] }),
      states: {
        a: { getNext: () => null },
      },
    });
    const engine = start(createEngine(initialState), config);
    const next = advance(engine);

    expect(next.state.log).toContain("machine:exit");
  });

  it("throws when no active machine", () => {
    const engine = { machineStack: [], state: initialState, started: false };
    expect(() => advance(engine)).toThrow("Cannot advance: no active machine");
  });

  it("modifies state through callbacks", () => {
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
    const engine = start(createEngine(initialState), config);

    expect(engine.state.count).toBe(1);

    const next = advance(engine);

    expect(next.state.count).toBe(11);
  });
});

describe("autoadvance", () => {
  it("automatically advances when autoadvance is true", () => {
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
    const engine = start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("b");
    expect(engine.state.log).toEqual(["a:enter", "b:enter"]);
  });

  it("automatically advances when autoadvance function returns true", () => {
    const config = makeConfig({
      states: {
        a: {
          autoadvance: (state) => state.count === 0,
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("b");
  });

  it("does not auto-advance when autoadvance function returns false", () => {
    const config = makeConfig({
      states: {
        a: {
          autoadvance: (state) => state.count > 100,
          getNext: () => "b",
        },
        b: { getNext: () => null },
      },
    });
    const engine = start(createEngine(initialState), config);

    expect(engine.machineStack[0].currentState).toBe("a");
  });
});

describe("nested machines", () => {
  it("pushes nested machine onto the stack", () => {
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
    const engine = start(createEngine(initialState), config);

    expect(engine.machineStack).toHaveLength(2);
    expect(engine.machineStack[0].config.id).toBe("test");
    expect(engine.machineStack[1].config.id).toBe("nested");
    expect(engine.machineStack[1].currentState).toBe("x");
  });

  it("pops nested machine and advances parent when nested completes", () => {
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
    const engine = start(createEngine(initialState), config);

    // nested machine is active at state x
    expect(engine.machineStack).toHaveLength(2);

    // advance completes nested, which pops it, then advances parent from a -> b
    const next = advance(engine);

    expect(next.machineStack).toHaveLength(1);
    expect(next.machineStack[0].currentState).toBe("b");
  });

  it("calls lifecycle hooks in correct order for nested machines", () => {
    const config: StateMachineConfig<TestState> = {
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
    const engine = start(createEngine(initialState), config);

    expect(engine.state.log).toEqual(["child:enter", "x:enter"]);

    // advance: x exits, child completes and exits, parent completes
    const next = advance(engine);

    expect(next.state.log).toEqual([
      "child:enter",
      "x:enter",
      "x:exit",
      "child:exit",
    ]);
  });
});

describe("immutability", () => {
  it("does not mutate the original engine state on advance", () => {
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
    const engine = start(createEngine(initialState), config);
    const snapshot = { ...engine, state: { ...engine.state } };

    advance(engine);

    expect(engine.state.count).toBe(snapshot.state.count);
    expect(engine.machineStack).toEqual(snapshot.machineStack);
  });

  it("does not mutate the original state object", () => {
    const config = makeConfig({
      states: {
        a: {
          onEnter: (state) => ({ ...state, count: 99 }),
          getNext: () => null,
        },
      },
    });
    const original: TestState = { count: 0, log: [] };
    start(createEngine(original), config);

    expect(original.count).toBe(0);
    expect(original.log).toEqual([]);
  });
});

describe("doAction", () => {
  it("applies the action to the state", () => {
    const config = makeConfig();
    const engine = start(createEngine(initialState), config);

    const next = doAction(engine, (state) => ({ ...state, count: 42 }));

    expect(next.state.count).toBe(42);
  });

  it("passes extra args through to the action", () => {
    const config = makeConfig();
    const engine = start(createEngine(initialState), config);

    const increment = (state: TestState, amount: number) => ({
      ...state,
      count: state.count + amount,
    });
    const next = doAction(engine, increment, 5);

    expect(next.state.count).toBe(5);
  });

  it("throws when machine not started", () => {
    const engine = createEngine(initialState);

    expect(() =>
      doAction(engine, (state) => state),
    ).toThrow("Cannot perform action: machine not started");
  });

  it("does not mutate the original engine state", () => {
    const config = makeConfig();
    const engine = start(createEngine(initialState), config);

    doAction(engine, (state) => ({ ...state, count: 99 }));

    expect(engine.state.count).toBe(0);
  });
});

describe("StateMachineEngine class", () => {
  it("throws when start is called twice", () => {
    const config = makeConfig();
    const engine = new StateMachineEngine(config, initialState);

    engine.start();

    expect(() => engine.start()).toThrow("Cannot start: machine already started");
  });

  it("throws when advance is called before start", () => {
    const config = makeConfig();
    const engine = new StateMachineEngine(config, initialState);

    expect(() => engine.advance()).toThrow("Cannot advance: no active machine");
  });

  it("doAction applies the action to the state", () => {
    const config = makeConfig();
    const engine = new StateMachineEngine(config, initialState);
    engine.start();

    engine.doAction((state) => ({ ...state, count: 7 }));

    expect(engine.state.count).toBe(7);
  });

  it("doAction throws when machine not started", () => {
    const config = makeConfig();
    const engine = new StateMachineEngine(config, initialState);

    expect(() =>
      engine.doAction((state) => state),
    ).toThrow("Cannot perform action: machine not started");
  });
});
