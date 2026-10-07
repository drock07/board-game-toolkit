// @vitest-environment jsdom
// The Devtools guide's claims: the graph marks the nodes waiting for input,
// and the inspector lists the root stack and a fiber per player.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Debug } from "./devtools";

afterEach(cleanup);

test("the graph and inspector show a simultaneous round", () => {
  const { container } = render(<Debug />);
  expect(screen.getByRole("figure", { name: "Game flow" })).toBeTruthy();
  // Both players' turns wait on their own fibers: one turn node, two frames
  const waiting = container.querySelectorAll('[data-status="waiting"]');
  expect([...waiting].map((n) => n.getAttribute("data-node"))).toEqual([
    "turn",
  ]);
  // A node running in several frames is marked with how many
  expect(screen.getByText("×2")).toBeTruthy();
  expect(screen.getAllByLabelText(/^Fiber /)).toHaveLength(3);
  expect(screen.getByText(/3 fibers · 0 pending/)).toBeTruthy();
});
