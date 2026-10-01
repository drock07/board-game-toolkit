import { GameDefinitionError } from "./errors.js";
import {
  inputError,
  type KindCtx,
  type Next,
  type NodeKind,
} from "./interpreter.js";
import type {
  BranchNode,
  DecisionAction,
  DecisionNode,
  FlowNode,
  LoopNode,
  PauseNode,
  SeqNode,
  StepNode,
} from "./spec.js";
import type { Frame } from "./types.js";

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
};

/** The built-in node kinds. */
export const builtinKinds = new Map<FlowNode["kind"], NodeKind<never>>([
  ["seq", seq],
  ["loop", loop],
  ["branch", branch],
  ["step", step],
  ["decision", decision],
  ["pause", pause],
] as [FlowNode["kind"], NodeKind<never>][]);
