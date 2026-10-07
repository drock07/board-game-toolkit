// The built-in node builders, each defined with its kind.
import * as kinds from "../kinds/index.js";
import type { Node as SpecNode } from "../types.js";
import {
  defineNode,
  node,
  type ActionLike,
  type WaitOptions,
} from "./types.js";

/** A waiting builder's arguments: optional options, then actions. */
const split = (
  args: readonly (WaitOptions | ActionLike<unknown>)[],
): [WaitOptions, ActionLike<unknown>[]] =>
  args.length && !("name" in args[0]!)
    ? [args[0] as WaitOptions, args.slice(1) as ActionLike<unknown>[]]
    : [{}, args as ActionLike<unknown>[]];

export const seqNode = defineNode("seq", {
  build: (...children) =>
    node(kinds.seq, (l) => ({
      kind: "seq",
      id: l.id("seq"),
      children: children.map(l.visit),
    })),
});

export const stepNode = defineNode("step", {
  build: (run) =>
    node(kinds.step, (l) => {
      const name = l.id("step");
      return { kind: "step", id: name, run: l.step(name, run) };
    }),
});

export const turnsNode = defineNode("turns", {
  build: (opts, body) =>
    node(kinds.turns, (l) => {
      const name = l.id("turns");
      return {
        kind: "turns",
        id: name,
        order: opts.order ?? "clockwise",
        ...(opts.until && { until: l.cond(`${name}.until`, opts.until) }),
        ...(opts.rounds !== undefined && { rounds: opts.rounds }),
        ...(opts.from && { from: l.query(`${name}.from`, opts.from) }),
        ...(opts.among && { among: l.query(`${name}.among`, opts.among) }),
        body: l.visit(body),
      };
    }),
});

export const loopNode = defineNode("loop", {
  build: (opts, body) =>
    node(kinds.loop, (l) => {
      const name = l.id("loop");
      return {
        kind: "loop",
        id: name,
        ...(opts.until && { until: l.cond(`${name}.until`, opts.until) }),
        body: l.visit(body),
      };
    }),
});

export const promptNode = defineNode("prompt", {
  build: (...args: (WaitOptions | ActionLike<unknown>)[]) => {
    const [opts, actions] = split(args);
    return node(kinds.prompt, (l) => ({
      kind: "prompt",
      id: l.id("prompt"),
      ...(opts.label !== undefined && { label: opts.label }),
      actions: actions.map((a) => l.action(a)),
    }));
  },
});

export const turnNode = defineNode("turn", {
  kind: kinds.turn,
  build: (opts, ...actions) =>
    node(kinds.turn, (l) => {
      const id = l.id("turn");
      return {
        kind: "turn",
        id,
        ...(opts.label !== undefined && { label: opts.label }),
        ...(opts.until && { until: l.cond(`${id}.until`, opts.until) }),
        ...(opts.limits && { limits: opts.limits as Record<string, number> }),
        ...(opts.first && { first: opts.first as string[] }),
        actions: actions.map((a) => l.action(a)),
      };
    }),
});

export const simultaneousNode = defineNode("simultaneous", {
  build: (body) =>
    node(kinds.simultaneous, (l) => ({
      kind: "simultaneous",
      id: l.id("simultaneous"),
      body: l.visit(body),
    })),
});

export const anyoneNode = defineNode("anyone", {
  build: (opts, ...actions) =>
    node(kinds.anyone, (l) => {
      const id = l.id("anyone");
      return {
        kind: "anyone",
        id,
        ...(opts.label !== undefined && { label: opts.label }),
        ...(opts.who && { who: l.query(`${id}.who`, opts.who) }),
        actions: actions.map((a) => l.action(a)),
      };
    }),
});

/** Shorthand for `simultaneous(prompt(...actions))`: one prompt per player, on their own fiber. */
export const everyoneNode = defineNode("everyone", {
  build: (...args: (WaitOptions | ActionLike<unknown>)[]) =>
    simultaneousNode.build(
      (
        promptNode.build as (
          ...a: typeof args
        ) => ReturnType<typeof promptNode.build>
      )(...args),
    ),
});

export const branchNode = defineNode("branch", {
  build: (cases, otherwise) =>
    node(kinds.branch, (l) => {
      const name = l.id("branch");
      return {
        kind: "branch",
        id: name,
        cases: cases.map((c, i) => ({
          when: l.cond(`${name}.when${i}`, c.when),
          then: l.visit(c.then),
        })),
        ...(otherwise && { else: l.visit(otherwise) }),
      };
    }),
});

export const outcomesNode = defineNode("outcomes", {
  build: (outcomes, body) =>
    node(kinds.outcomes, (l) => {
      const name = l.id("outcomes");
      const lowered: Record<string, { when?: string; then?: SpecNode }> = {};
      for (const [outcome, o] of Object.entries(outcomes)) {
        lowered[outcome] = {
          ...(o.when && { when: l.cond(`${name}.${outcome}`, o.when) }),
          ...(o.then && { then: l.visit(o.then) }),
        };
      }
      return {
        kind: "outcomes",
        id: name,
        outcomes: lowered,
        body: l.visit(body),
      };
    }),
});

export const defaultNodes = [
  seqNode,
  stepNode,
  turnsNode,
  loopNode,
  promptNode,
  turnNode,
  everyoneNode,
  anyoneNode,
  simultaneousNode,
  branchNode,
  outcomesNode,
] as const;
