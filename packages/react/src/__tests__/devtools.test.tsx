// @vitest-environment jsdom
import { init } from "@drock07/board-game-toolkit-engine";
import { render, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { FiberInspector } from "../devtools/FiberInspector.js";
import { FlowGraph, nodeDetails } from "../devtools/FlowGraph.js";
import { atOnceGame, drawGame } from "./games.js";

const boxes = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("[data-node]")].map((b) => ({
    id: b.dataset.node,
    status: b.dataset.status,
  }));

describe("FlowGraph", () => {
  test("draws one box per node, the flow first, then effects and abilities", () => {
    const { container } = render(<FlowGraph game={drawGame} />);
    expect(boxes(container).map((b) => b.id)).toEqual([
      "loop",
      "seq",
      "turns",
      "prompt",
      "prompt2",
      "effect.drew",
    ]);
  });

  test("outlines running nodes and fills those waiting for input", () => {
    const state = init(drawGame, { players: ["p1", "p2"], seed: "s" });
    const { container } = render(<FlowGraph game={drawGame} state={state} />);
    expect(boxes(container)).toEqual([
      { id: "loop", status: "active" },
      { id: "seq", status: "active" },
      { id: "turns", status: "active" },
      { id: "prompt", status: "waiting" },
      { id: "prompt2", status: "idle" },
      { id: "effect.drew", status: "idle" },
    ]);
  });

  test("counts a node's frames across fibers", () => {
    const state = init(atOnceGame, { players: ["a", "b", "c"], seed: "s" });
    const { container } = render(<FlowGraph game={atOnceGame} state={state} />);
    const turn = container.querySelector<HTMLElement>('[data-node="turn"]')!;
    expect(turn.dataset.status).toBe("waiting");
    expect(within(turn).getByText("×3")).toBeTruthy();
  });

  test("details show what the spec node holds: labels, names, actions, limits", () => {
    const turn = atOnceGame.spec.flow;
    expect(JSON.stringify(turn)).toContain('"kind":"turn"');
    const node = (
      turn as unknown as {
        children: [{ body: Parameters<typeof nodeDetails>[0] }];
      }
    ).children[0].body;
    expect(nodeDetails(node)).toEqual([
      "“Your turn”",
      "limits tap 2",
      "actions tap, stop",
    ]);
  });
});

describe("FiberInspector", () => {
  test("lists the root stack and each fiber, innermost frame first", () => {
    const state = init(atOnceGame, { players: ["a", "b"], seed: "s" });
    const { container } = render(
      <FiberInspector game={atOnceGame} state={state} />,
    );
    const cards = [...container.querySelectorAll<HTMLElement>("[data-fiber]")];
    expect(cards.map((c) => c.dataset.fiber)).toEqual(["root", "f1", "f2"]);
    expect(within(cards[0]!).getByText("blocked")).toBeTruthy();
    expect(within(cards[1]!).getByText("waiting")).toBeTruthy();
    expect(within(cards[1]!).getByText(/for a/)).toBeTruthy();
    const rows = cards[0]!.querySelectorAll("tbody tr");
    expect([...rows].map((r) => r.children[1]!.textContent)).toEqual([
      "simultaneous",
      "seq",
    ]);
  });

  test("shows the queue of pending abilities and effects", () => {
    const state = init(drawGame, { players: ["p1", "p2"], seed: "s" });
    const queued = {
      ...state,
      pending: [
        {
          effect: "drew",
          data: { by: "p1", count: 1 },
          fiber: "root",
          depth: 1,
        },
      ],
    };
    const { container } = render(
      <FiberInspector game={drawGame} state={queued} />,
    );
    const pending = container.querySelector<HTMLElement>(
      '[data-fiber="pending"]',
    )!;
    expect(within(pending).getByText(/effect drew/)).toBeTruthy();
  });
});
