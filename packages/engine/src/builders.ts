import type { Json } from "./json.js";
import type {
  Actor,
  CommonOptions,
  Cond,
  DecisionAction,
  FlowNode,
  Over,
} from "./spec.js";

// Builders return plain objects: `seq("game", [...], { exits })` is exactly
// `{ kind: "seq", id: "game", children: [...], exits }`. Const type parameters
// keep every ref's literal type, so `defineGame` can check refs against the
// impl.

// The `{}` defaults keep the result type clean when options are omitted
/* eslint-disable @typescript-eslint/no-empty-object-type */

export function seq<
  const C extends readonly FlowNode[],
  const O extends CommonOptions = {},
>(
  id: string,
  children: C,
  opts?: O,
): NoInfer<{ kind: "seq"; id: string; children: C } & O> {
  return { kind: "seq", id, children, ...opts } as never;
}

export function loop<
  const B extends FlowNode,
  const O extends CommonOptions & {
    until?: Cond;
    while?: Cond;
    times?: number;
  } = {},
>(
  id: string,
  body: B,
  opts?: O,
): NoInfer<{ kind: "loop"; id: string; body: B } & O> {
  return { kind: "loop", id, body, ...opts } as never;
}

export function each<
  const V extends Over,
  const B extends FlowNode,
  const O extends CommonOptions & {
    mode?: "sequential" | "parallel";
    until?: Cond;
    repeat?: boolean;
  } = {},
>(
  id: string,
  over: V,
  body: B,
  opts?: O,
): NoInfer<{ kind: "each"; id: string; over: V; body: B } & O> {
  return { kind: "each", id, over, body, ...opts } as never;
}

export function branch<
  const C extends readonly { when: Cond; then: FlowNode }[],
  const E extends FlowNode | undefined = undefined,
  const O extends CommonOptions = {},
>(
  id: string,
  cases: C,
  otherwise?: E,
  opts?: O,
): NoInfer<
  { kind: "branch"; id: string; cases: C } & (E extends FlowNode
    ? { else: E }
    : {}) &
    O
> {
  return {
    kind: "branch",
    id,
    cases,
    ...(otherwise ? { else: otherwise } : {}),
    ...opts,
  } as never;
}

export function step<
  const R extends string,
  const O extends CommonOptions = {},
>(
  id: string,
  run: R,
  opts?: O,
): NoInfer<{ kind: "step"; id: string; run: R } & O> {
  return { kind: "step", id, run, ...opts } as never;
}

export function decision<
  const D extends { actor: Actor; endWhen?: Cond },
  const A extends { readonly [name: string]: DecisionAction },
  const O extends CommonOptions = {},
>(
  id: string,
  opts: D,
  actions: A,
  common?: O,
): NoInfer<{ kind: "decision"; id: string; actions: A } & D & O> {
  return { kind: "decision", id, ...opts, actions, ...common } as never;
}

export function choose<
  const D extends CommonOptions & {
    actor: Actor;
    options: string | readonly Json[];
    min?: number;
    max?: number;
    apply: string;
  },
>(id: string, opts: D): NoInfer<{ kind: "choose"; id: string } & D> {
  return { kind: "choose", id, ...opts } as never;
}

export function pause<
  const O extends CommonOptions & { actor?: Actor; label?: string } = {},
>(id: string, opts?: O): NoInfer<{ kind: "pause"; id: string } & O> {
  return { kind: "pause", id, ...opts } as never;
}

export function parallel<
  const C extends readonly FlowNode[],
  const O extends CommonOptions & { join: "all" | "race" },
>(
  id: string,
  children: C,
  opts: O,
): NoInfer<{ kind: "parallel"; id: string; children: C } & O> {
  return { kind: "parallel", id, children, ...opts } as never;
}

export function exit<const O extends CommonOptions = {}>(
  id: string,
  outcome: string,
  opts?: O,
): NoInfer<{ kind: "exit"; id: string; outcome: string } & O> {
  return { kind: "exit", id, outcome, ...opts } as never;
}

export function use<const O extends CommonOptions = {}>(
  id: string,
  subflow: string,
  opts?: O,
): NoInfer<{ kind: "use"; id: string; subflow: string } & O> {
  return { kind: "use", id, subflow, ...opts } as never;
}
