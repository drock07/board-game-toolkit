// Control flow: sequence, steps, loops, branches and early outcomes.
import { isExit, type Kind, type Node } from "../types.js";

type Of<K extends string> = Extract<Node, { kind: K }>;

/** Runs its children in order. */
export const seq: Kind<Of<"seq">> = {
  children: (n) => n.children,
  run: (n, f) =>
    f.i < n.children.length ? { pass: n.children[f.i]! } : "done",
};

/** Runs `impl.steps[run]` in a transaction and ends. */
export const step: Kind<Of<"step">> = {
  children: () => [],
  run(n, _f, ctx) {
    const out = ctx.transact((tx) => ctx.game.impl.steps[n.run]!(tx));
    return isExit(out) ? out : "done";
  },
};

/** Repeats its body until `until` holds (forever when absent), checked before each pass. */
export const loop: Kind<Of<"loop">> = {
  children: (n) => [n.body],
  run: (n, _f, ctx) =>
    n.until !== undefined && ctx.holds(n.until) ? "done" : { pass: n.body },
};

/** Runs the first case whose condition holds, or `else`, then ends. */
export const branch: Kind<Of<"branch">> = {
  children: (n) => [...n.cases.map((c) => c.then), ...(n.else ? [n.else] : [])],
  run(n, f, ctx) {
    if (f.i > 0) return "done";
    const hit = n.cases.find((c) => ctx.holds(c.when));
    const then = hit ? hit.then : n.else;
    return then ? { pass: then } : "done";
  },
};

interface OutcomesData {
  /** The outcome being handled, once one fired. */
  handling?: string;
}

/**
 * The ways `body` may end early. Guards (`when`) are checked after every
 * transaction; any outcome may be raised from inside. On an outcome the body
 * is cancelled, `then` runs if present, and the node ends. While `then`
 * runs, this node's guards are off and it catches nothing, so an outcome
 * raised by a handler unwinds past it.
 */
export const outcomes: Kind<Of<"outcomes">> = {
  children: (n) => [
    n.body,
    ...Object.values(n.outcomes).flatMap((o) => (o.then ? [o.then] : [])),
  ],
  run: (n, f) => (f.i === 0 ? { pass: n.body } : "done"),
  check(n, f, ctx) {
    if ((f.data as OutcomesData | undefined)?.handling) return undefined;
    for (const [name, o] of Object.entries(n.outcomes))
      if (o.when !== undefined && ctx.holds(o.when)) return name;
    return undefined;
  },
  catches: (n, f, outcome) =>
    !(f.data as OutcomesData | undefined)?.handling && outcome in n.outcomes,
  exited(n, f, outcome) {
    f.data = { handling: outcome } satisfies OutcomesData;
    const then = n.outcomes[outcome]!.then;
    return then ? { pass: then } : "done";
  },
};
