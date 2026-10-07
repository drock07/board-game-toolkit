// The built-in node builders, each defined with its kind.
import * as kinds from "../kinds/index.js";
import type { Node as SpecNode } from "../types.js";
import { defineNode, node } from "./types.js";

export const seqNode = defineNode("seq", {
  kind: kinds.seq,
  build: (...children) =>
    node(kinds.seq, (l) => ({
      kind: "seq",
      id: l.id("seq"),
      children: children.map(l.visit),
    })),
});

export const stepNode = defineNode("step", {
  kind: kinds.step,
  build: (run) =>
    node(kinds.step, (l) => {
      const name = l.id("step");
      return { kind: "step", id: name, run: l.step(name, run) };
    }),
});

export const turnsNode = defineNode("turns", {
  kind: kinds.turns,
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
  kind: kinds.loop,
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
  kind: kinds.prompt,
  build: (...actions) =>
    node(kinds.prompt, (l) => ({
      kind: "prompt",
      id: l.id("prompt"),
      actions: actions.map((a) => l.action(a)),
    })),
});

export const simultaneousNode = defineNode("simultaneous", {
  kind: kinds.simultaneous,
  build: (body) =>
    node(kinds.simultaneous, (l) => ({
      kind: "simultaneous",
      id: l.id("simultaneous"),
      body: l.visit(body),
    })),
});

export const anyoneNode = defineNode("anyone", {
  kind: kinds.anyone,
  build: (opts, ...actions) =>
    node(kinds.anyone, (l) => {
      const id = l.id("anyone");
      return {
        kind: "anyone",
        id,
        ...(opts.who && { who: l.query(`${id}.who`, opts.who) }),
        actions: actions.map((a) => l.action(a)),
      };
    }),
});

export const everyoneNode = defineNode("everyone", {
  kind: kinds.everyone,
  build: (...actions) =>
    node(kinds.everyone, (l) => ({
      kind: "everyone",
      id: l.id("everyone"),
      actions: actions.map((a) => l.action(a)),
    })),
});

export const branchNode = defineNode("branch", {
  kind: kinds.branch,
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
  kind: kinds.outcomes,
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
  everyoneNode,
  anyoneNode,
  simultaneousNode,
  branchNode,
  outcomesNode,
] as const;
