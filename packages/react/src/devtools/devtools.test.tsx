// @vitest-environment jsdom
import {
  branch,
  decision,
  defineGame,
  each,
  init,
  loop,
  pause,
  seq,
  step,
  subflow,
  type AnyTypes,
  type GameImpl,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";
import { render, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { FiberInspector } from "./FiberInspector.js";
import { FlowGraph, nodeDetails } from "./FlowGraph.js";

const spec = {
  id: "devtools",
  version: 1,
  players: { min: 3, max: 3 },
  zones: { pile: { visibility: "public" } },
  vars: { round: {} },
  flow: loop(
    "session",
    seq("round", [
      step("setup", "setup"),
      each(
        "bids",
        { players: "clockwise" },
        decision(
          "bid",
          { actor: "current" },
          { go: {}, wait: { ends: false } },
        ),
        { mode: "parallel" },
      ),
      branch("check", [
        {
          when: { gte: [{ var: "vars.round" }, 3] },
          then: subflow("finale", "finale"),
        },
      ]),
    ]),
    { exits: { over: { ref: "done" } } },
  ),
  subflows: { finale: pause("bow", { label: "Bow" }) },
  triggers: [
    {
      id: "noted",
      on: { type: "created", entityType: "chip" },
      flow: step("note", "setup"),
    },
  ],
} as const satisfies GameSpec;

const game = defineGame({
  spec,
  impl: {
    setup(tx) {
      tx.vars = { round: 0 };
    },
    conditions: { done: () => false },
    steps: { setup: () => {} },
    actions: { go: { execute: () => {} }, wait: { execute: () => {} } },
  } satisfies GameImpl<AnyTypes>,
});
const start = () => init(game, { players: ["p1", "p2", "p3"], seed: "s" });

describe("FlowGraph", () => {
  test("draws one box per node, including subflow and trigger nodes", () => {
    const { container } = render(<FlowGraph game={game} />);
    const ids = [...container.querySelectorAll("[data-node]")].map((e) =>
      e.getAttribute("data-node"),
    );
    expect(ids.sort()).toEqual([...game.nodes.keys()].sort());
    expect(ids).toContain("finale.bow");
    expect(container.textContent).toContain("trigger");
    expect(container.textContent).toContain("when vars.round >= 3");
  });

  test("outlines running nodes and fills those waiting for input", () => {
    const { container } = render(
      <FlowGraph game={game} flow={start().state.flow} />,
    );
    const status = (id: string) =>
      container
        .querySelector(`[data-node="${id}"]`)!
        .getAttribute("data-status");
    expect(status("session")).toBe("active");
    expect(status("bids")).toBe("active");
    expect(status("bid")).toBe("waiting");
    expect(status("setup")).toBe("idle");
    expect(status("finale.bow")).toBe("idle");
    // Three players bid at once: three frames of the same node
    expect(
      within(container.querySelector('[data-node="bid"]')!).getByText("×3"),
    ).toBeTruthy();
  });

  test("details describe guards, actors and refs", () => {
    expect(nodeDetails(spec.flow)).toEqual(["exits over: done"]);
    const bids = spec.flow.body.children[1];
    expect(nodeDetails(bids)).toEqual(["over players clockwise"]);
    expect(nodeDetails(bids.body)).toEqual(["actor current"]);
  });
});

describe("FiberInspector", () => {
  test("lists live fibers with their stacks and open prompts", () => {
    const { container, getByLabelText } = render(
      <FiberInspector flow={start().state.flow} />,
    );
    // The root fiber plus one per bidder
    expect(container.querySelectorAll("[data-fiber]")).toHaveLength(4);
    const root = getByLabelText("Fiber f0");
    expect(root.textContent).toContain("bids");
    const child = getByLabelText("Fiber f1");
    expect(child.textContent).toContain("spawned by f0");
    expect(child.textContent).toContain("player p1");
    expect(child.textContent).toMatch(/q\d+ → p1/);
  });
});
