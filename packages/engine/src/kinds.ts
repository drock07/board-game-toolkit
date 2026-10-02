import type { ExpandedUse } from "./compile.js";
import { GameDefinitionError } from "./errors.js";
import {
  inputError,
  type KindCtx,
  type Next,
  type NodeKind,
} from "./interpreter.js";
import { jsonEqual, type Json } from "./json.js";
import type {
  BranchNode,
  ChooseNode,
  DecisionAction,
  DecisionNode,
  EachNode,
  ExitNode,
  FlowNode,
  LoopNode,
  ParallelNode,
  PauseNode,
  SeqNode,
  StepNode,
} from "./spec.js";
import type { Binding, Frame, Input, PlayerId } from "./types.js";

const DONE: Next = { end: "done" };

const seq: NodeKind<SeqNode> = {
  enter(_ctx, frame, node) {
    const first = node.children[0];
    if (!first) return DONE;
    frame.data = 0;
    return { push: first.id };
  },
  childEnded(_ctx, frame, node) {
    const i = (frame.data as number) + 1;
    frame.data = i;
    const child = node.children[i];
    return child ? { push: child.id } : DONE;
  },
};

/** Starts the next iteration, or ends if `while` or `times` says so. */
function nextIteration(ctx: KindCtx, frame: Frame, node: LoopNode): Next {
  const iteration = frame.data as number;
  if (node.times !== undefined && iteration >= node.times) return DONE;
  if (node.while !== undefined && !ctx.cond(node.while)) return DONE;
  return { push: node.body.id, binding: { iteration } };
}

const loop: NodeKind<LoopNode> = {
  enter(ctx, frame, node) {
    frame.data = 0;
    return nextIteration(ctx, frame, node);
  },
  childEnded(ctx, frame, node) {
    frame.data = (frame.data as number) + 1;
    if (node.until !== undefined && ctx.cond(node.until)) return DONE;
    return nextIteration(ctx, frame, node);
  },
};

const branch: NodeKind<BranchNode> = {
  enter(ctx, _frame, node) {
    for (const c of node.cases)
      if (ctx.cond(c.when)) return { push: c.then.id };
    return node.else ? { push: node.else.id } : DONE;
  },
  childEnded: () => DONE,
};

const step: NodeKind<StepNode> = {
  enter(ctx, _frame, node) {
    const fn = ctx.game.impl.steps?.[node.run];
    if (!fn) throw new GameDefinitionError(`Missing impl.steps.${node.run}`);
    ctx.tx(fn);
    return DONE;
  },
  childEnded: () => DONE,
};

/** After an action (and its `then` flow): end, or re-prompt unless `endWhen` holds. */
function afterAction(
  ctx: KindCtx,
  node: DecisionNode,
  action: DecisionAction,
): Next {
  if (action.ends ?? true) return DONE;
  if (node.endWhen !== undefined && ctx.cond(node.endWhen)) return DONE;
  return { block: true };
}

const decision: NodeKind<DecisionNode> = {
  enter: () => ({ block: true }),
  childEnded(ctx, frame, node) {
    const name = frame.data as string;
    frame.data = null;
    return afterAction(ctx, node, node.actions[name]!);
  },
  prompt(ctx, _frame, node) {
    return {
      kind: "decision",
      actors: ctx.actors(node.actor),
      actions: Object.entries(node.actions).map(([name, a]) => ({
        name,
        ends: a.ends ?? true,
      })),
    };
  },
  input(ctx, frame, node, input) {
    if (!("action" in input)) {
      return inputError("invalid_args", `"${node.id}" expects an action`);
    }
    const action = node.actions[input.action];
    const def = ctx.game.impl.actions?.[input.action];
    if (!action || !def) {
      return inputError(
        "unknown_action",
        `"${node.id}" has no action "${input.action}"`,
      );
    }
    const args = input.args ?? {};
    const valid = def.validate?.(ctx.reader(), args, {
      ...ctx.scope,
      actor: input.player,
    });
    if (valid !== undefined && valid !== true) {
      return inputError("validation_failed", valid);
    }
    ctx.tx((tx) => def.execute(tx, args), input.player);
    if (action.then) {
      frame.data = input.action;
      return { push: action.then.id };
    }
    return afterAction(ctx, node, action);
  },
  legal(ctx, frame, node, player) {
    const out: Input[] = [];
    const scope = { ...ctx.scope, actor: player };
    const reader = ctx.reader();
    for (const name of Object.keys(node.actions)) {
      const def = ctx.game.impl.actions?.[name];
      if (!def) continue;
      // Without `enumerate`, an action is offered with no args (see Q2)
      const candidates: (Json | undefined)[] = def.enumerate
        ? (def.enumerate(reader, scope) as Json[])
        : [undefined];
      for (const args of candidates) {
        const valid = def.validate?.(reader, args ?? {}, scope) ?? true;
        if (valid !== true) continue;
        const input: Input = { prompt: frame.prompt!.id, player, action: name };
        if (args !== undefined) input.args = args;
        out.push(input);
      }
    }
    return out;
  },
};

const pause: NodeKind<PauseNode> = {
  enter: () => ({ block: true }),
  childEnded: () => DONE,
  prompt(ctx, _frame, node) {
    return {
      kind: "pause",
      actors: ctx.actors(node.actor ?? "any"),
      label: node.label,
    };
  },
  input(_ctx, _frame, node, input) {
    if (!("continue" in input) || input.continue !== true) {
      return inputError(
        "invalid_args",
        `"${node.id}" expects { continue: true }`,
      );
    }
    return DONE;
  },
  legal: (_ctx, frame, _node, player) => [
    { prompt: frame.prompt!.id, player, continue: true },
  ],
};

// ---------------------------------------------------------------------------
// each

type EachData = {
  items: Json[];
  index: number;
  /** The first player of each pass, when iterating players. */
  start?: PlayerId;
};

/** The items for one pass: players in seat order from `start`, or a list. */
function eachItems(ctx: KindCtx, node: EachNode, start?: PlayerId): Json[] {
  if ("ref" in node.over) return ctx.list(node.over.ref);
  const seats = [...ctx.state.players];
  const first = start ?? seats[0]!;
  if (node.over.players === "counterclockwise") seats.reverse();
  const at = Math.max(0, seats.indexOf(first));
  return [...seats.slice(at), ...seats.slice(0, at)];
}

function pushItem(node: EachNode, items: Json[], index: number): Next {
  const item = items[index]!;
  const binding =
    "players" in node.over ? { player: item as PlayerId } : { item };
  return { push: node.body.id, binding };
}

const each: NodeKind<EachNode> = {
  enter(ctx, frame, node) {
    let start: PlayerId | undefined;
    if ("players" in node.over) {
      const from = node.over.from ?? "first";
      if (from === "random") {
        ctx.tx((tx) => {
          start = tx.random.pick(tx.state.players);
        });
      } else if (typeof from === "object") {
        const [first] = ctx.list(from.ref);
        if (typeof first !== "string" || !ctx.state.players.includes(first)) {
          throw new GameDefinitionError(
            `"${node.id}" start list "${from.ref}" must return a player id first`,
          );
        }
        start = first;
      }
    }
    const data: EachData = { items: eachItems(ctx, node, start), index: 0 };
    if (start !== undefined) data.start = start;
    frame.data = data;
    if (node.mode === "parallel") {
      // A fiber per item, joined on all of them
      return {
        spawn: data.items.map((_, i) => {
          const branch = pushItem(node, data.items, i) as {
            push: string;
            binding: Binding;
          };
          return { node: branch.push, binding: branch.binding };
        }),
        join: "all",
      };
    }
    return data.items.length ? pushItem(node, data.items, 0) : DONE;
  },
  childEnded(ctx, frame, node) {
    if (node.mode === "parallel") return DONE;
    const data = frame.data as EachData;
    data.index++;
    if (node.until !== undefined && ctx.cond(node.until)) return DONE;
    if (data.index >= data.items.length) {
      if (!node.repeat) return DONE;
      // Recomputed each pass, so eliminated players drop out
      data.items = eachItems(ctx, node, data.start);
      data.index = 0;
      if (!data.items.length) return DONE;
    }
    return pushItem(node, data.items, data.index);
  },
};

// ---------------------------------------------------------------------------
// choose

/** Every subset of `options` (in option order) sized min..max, up to `limit`. */
function subsets(
  options: Json[],
  min: number,
  max: number,
  limit = 1000,
): Json[][] {
  const out: Json[][] = [];
  const pick = (from: number, chosen: Json[]) => {
    if (out.length >= limit) return;
    if (chosen.length >= min) out.push([...chosen]);
    if (chosen.length === max) return;
    for (let i = from; i < options.length; i++) {
      chosen.push(options[i]!);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

const choose: NodeKind<ChooseNode> = {
  enter: () => ({ block: true }),
  childEnded: () => DONE,
  prompt(ctx, _frame, node) {
    const options =
      typeof node.options === "string"
        ? ctx.list(node.options)
        : [...node.options];
    const min = node.min ?? 1;
    const max = node.max ?? 1;
    if (options.length < min) {
      throw new GameDefinitionError(
        `"${node.id}" offers ${options.length} options but needs at least ${min}`,
      );
    }
    return {
      kind: "choose",
      actors: ctx.actors(node.actor),
      options,
      min,
      max,
    };
  },
  input(ctx, frame, node, input) {
    if (!("choose" in input) || !Array.isArray(input.choose)) {
      return inputError(
        "invalid_args",
        `"${node.id}" expects { choose: [...] }`,
      );
    }
    const prompt = frame.prompt!;
    const selection = input.choose;
    const { min = 1, max = 1, options = [] } = prompt;
    if (selection.length < min || selection.length > max) {
      return inputError(
        "bad_selection",
        min === max ? `Choose ${min}` : `Choose between ${min} and ${max}`,
      );
    }
    const used = new Set<number>();
    for (const item of selection) {
      const i = options.findIndex((o, j) => !used.has(j) && jsonEqual(o, item));
      if (i < 0) {
        return inputError(
          "bad_selection",
          `${JSON.stringify(item)} isn't an option`,
        );
      }
      used.add(i);
    }
    const fn = ctx.game.impl.choices?.[node.apply];
    if (!fn)
      throw new GameDefinitionError(`Missing impl.choices.${node.apply}`);
    ctx.tx((tx) => fn(tx, selection), input.player);
    return DONE;
  },
  legal(_ctx, frame, _node, player) {
    const { options = [], min = 1, max = 1, id } = frame.prompt!;
    return subsets(options, min, max).map((choose) => ({
      prompt: id,
      player,
      choose,
    }));
  },
};

// ---------------------------------------------------------------------------
// exit and use

/** Raises its outcome: the nearest enclosing node that handles it ends. */
const exit: NodeKind<ExitNode> = {
  enter: (_ctx, _frame, node) => ({ end: node.outcome }),
  childEnded: () => DONE,
};

/** Runs the subflow the compiler expanded into `body`. */
const use: NodeKind<ExpandedUse> = {
  enter: (_ctx, _frame, node) => ({ push: node.body.id }),
  childEnded: () => DONE,
};

// ---------------------------------------------------------------------------
// parallel

/** A fiber per child. `all` waits for every one; `race` ends on the first. */
const parallel: NodeKind<ParallelNode> = {
  enter: (_ctx, _frame, node) => ({
    spawn: node.children.map((c) => ({ node: c.id })),
    join: node.join,
  }),
  childEnded: () => DONE,
};

/** The built-in node kinds. */
export const builtinKinds = new Map<FlowNode["kind"], NodeKind<never>>([
  ["seq", seq],
  ["loop", loop],
  ["branch", branch],
  ["step", step],
  ["decision", decision],
  ["pause", pause],
  ["each", each],
  ["choose", choose],
  ["exit", exit],
  ["use", use],
  ["parallel", parallel],
] as [FlowNode["kind"], NodeKind<never>][]);
