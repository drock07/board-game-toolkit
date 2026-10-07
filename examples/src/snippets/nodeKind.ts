// The node kinds guide's two custom kinds. `rollCall` waits until each of
// a set of players has answered once, on one frame; `repeat` runs its body
// a fixed number of times and tells the body which pass it's on.
import {
  defaultNodes,
  define,
  type ActionLike,
  type Node,
  type PlayerId,
  type Reader,
  type Scoped,
  type WaitOptions,
} from "@drock07/board-game-toolkit-engine";
import {
  defineNode,
  isExit,
  node,
  type Frame,
  type Kind,
  type ReadCtx,
  type SpecNode,
} from "@drock07/board-game-toolkit-engine/kinds";

// #region rollCallKind
/** The spec node: JSON, with rules code replaced by names. */
type RollCallNode = {
  kind: "rollCall";
  id: string;
  label?: string;
  /** A query listing who must answer; everyone when absent. */
  who?: string;
  actions: string[];
};

/** What it shows players: who has answered so far. */
export interface RollCallShown {
  answered: PlayerId[];
}

const answeredIn = (f: Frame) =>
  (f.data as RollCallShown | undefined)?.answered ?? [];

/** Who still has to answer. */
const missing = (n: RollCallNode, f: Frame, ctx: ReadCtx<unknown>) => {
  const all =
    n.who === undefined ? ctx.state.players : (ctx.query(n.who) as PlayerId[]);
  return all.filter((p) => !answeredIn(f).includes(p));
};

const rollCallKind: Kind<RollCallNode, RollCallShown> = {
  children: () => [],
  run: () => "wait",
  actors: missing,
  actions: (n) => n.actions,
  answered(n, f, answer, ctx) {
    if (isExit(answer.result)) return answer.result;
    f.data = {
      answered: [...answeredIn(f), answer.player],
    } satisfies RollCallShown;
    return missing(n, f, ctx).length ? "wait" : "done";
  },
  show: (_n, f) => ({ answered: answeredIn(f) }),
};
// #endregion rollCallKind

// #region repeatKind
type RepeatNode = { kind: "repeat"; id: string; times: number; body: SpecNode };

export interface RepeatShown {
  pass: number;
  of: number;
}

const repeatKind: Kind<RepeatNode, RepeatShown> = {
  children: (n) => [n.body],
  // Called on entry and each time the body ends; `f.i` counts passes started
  run: (n, f) => (f.i < n.times ? { pass: n.body } : "done"),
  // What the body reads with `s.scopeOf(n.id)`: the pass it's in, from 1
  scope: (_n, f) => f.i,
  show: (n, f) => (f.i > 0 ? { pass: f.i, of: n.times } : undefined),
};
// #endregion repeatKind

// #region builders
export type RollCallBuilder<V> = <const H extends ActionLike<V>[]>(
  opts: WaitOptions & { who?: (s: Reader<V>) => PlayerId[] },
  ...actions: H
) => Node<V, H[number]>;

export type RepeatBuilder<V> = <H>(
  times: number,
  body: (r: { pass: (s: Scoped) => number }) => Node<V, H>,
) => Node<V, H>;

declare module "@drock07/board-game-toolkit-engine" {
  interface NodeBuilders<V> {
    rollCall: RollCallBuilder<V>;
    repeat: RepeatBuilder<V>;
  }
}

export const rollCallNode = defineNode("rollCall", {
  kind: rollCallKind,
  build: (opts, ...actions) =>
    node(rollCallKind, (l) => {
      const id = l.id("rollCall");
      return {
        kind: "rollCall",
        id,
        ...(opts.label !== undefined && { label: opts.label }),
        ...(opts.who && { who: l.query(`${id}.who`, opts.who) }),
        actions: actions.map((a) => l.action(a)),
      };
    }),
});

export const repeatNode = defineNode("repeat", {
  kind: repeatKind,
  build: (times, body) =>
    node(repeatKind, (l) => {
      const id = l.id("repeat");
      // A typed accessor over the node's scope, closed over its id
      const r = { pass: (s: Scoped) => s.scopeOf(id) as number };
      return { kind: "repeat", id, times, body: l.visit(body(r)) };
    }),
});
// #endregion builders

// #region game
interface Vars {
  away: PlayerId[];
  log: string[];
}

const { rules, action, seq, step, prompt, rollCall, repeat } =
  define<Vars>().withNodes([...defaultNodes, rollCallNode, repeatNode]);

export const ready = action("ready", {
  execute: (tx, actor) => void tx.vars.log.push(`${actor} is ready`),
});

export const game = rules({
  players: [2, 4],
  setup: (tx) => void (tx.vars = { away: [tx.players[1]!], log: [] }),
  flow: seq(
    rollCall(
      {
        label: "Ready?",
        who: (s) => s.players.filter((p) => !s.vars.away.includes(p)),
      },
      ready,
    ),
    repeat(3, (r) =>
      prompt(
        { label: "Next" },
        action("tick", {
          execute: (tx) => void tx.vars.log.push(`pass ${r.pass(tx)}`),
        }),
      ),
    ),
    step((tx) => tx.end()),
  ),
});
// #endregion game
