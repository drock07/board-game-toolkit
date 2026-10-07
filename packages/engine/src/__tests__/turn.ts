// A custom node kind: `turn` holds a prompt open across several answers and
// ends when an action returns "end" or `until` holds. Options: `limits`
// (how many times each action may be taken this turn) and `first` (the
// only actions allowed as the first answer). Per-turn counts live in the
// frame's data, so nothing in vars needs resetting.
import { type ActionLike, type Node, type Reader } from "../index.js";
import { defineNode, isExit, node, type Kind } from "../kinds/index.js";

/** The spec node. A `type` (not interface) so it fits `CustomNode`. */
export type TurnNode = {
  kind: "turn";
  id: string;
  until?: string;
  limits?: Record<string, number>;
  first?: string[];
  actions: string[];
};

export type TurnBuilder<V> = <const H extends ActionLike<V>[]>(
  opts: {
    until?: (s: Reader<V>) => boolean;
    /** How many times each action may be taken this turn. */
    limits?: { [K in H[number]["name"]]?: number };
    /** The only actions allowed as the turn's first answer. */
    first?: H[number]["name"][];
  },
  ...actions: H
) => Node<V, H[number]>;

declare module "../define/types.js" {
  interface NodeBuilders<V> {
    turn: TurnBuilder<V>;
  }
}

interface TurnData {
  /** Answers given this turn, in total and per action. */
  answers: number;
  counts: Record<string, number>;
}

const dataOf = (f: { data?: unknown }): TurnData =>
  (f.data as TurnData | undefined) ?? { answers: 0, counts: {} };

const kind: Kind<TurnNode> = {
  children: () => [],
  run: (n, _f, ctx) =>
    n.until !== undefined && ctx.holds(n.until) ? "done" : "wait",
  actions(n, f) {
    const { answers, counts } = dataOf(f);
    return n.actions.filter((a) => {
      if (answers === 0 && n.first && !n.first.includes(a)) return false;
      const limit = n.limits?.[a];
      return limit === undefined || (counts[a] ?? 0) < limit;
    });
  },
  answered(n, f, answer, ctx) {
    const { answers, counts } = dataOf(f);
    f.data = {
      answers: answers + 1,
      counts: { ...counts, [answer.action]: (counts[answer.action] ?? 0) + 1 },
    } satisfies TurnData;
    if (isExit(answer.result)) return answer.result;
    return answer.result === "end" ||
      (n.until !== undefined && ctx.holds(n.until))
      ? "done"
      : "wait";
  },
};

export const turnNode = defineNode("turn", {
  kind,
  build: (opts, ...actions) =>
    node(kind, (l) => {
      const id = l.id("turn");
      return {
        kind: "turn",
        id,
        ...(opts.until && { until: l.cond(`${id}.until`, opts.until) }),
        ...(opts.limits && { limits: opts.limits as Record<string, number> }),
        ...(opts.first && { first: opts.first }),
        actions: actions.map((a) => l.action(a)),
      } satisfies TurnNode;
    }),
});
