// The "What nodes show" page's claims, checked.
import {
  apply,
  init,
  loopNode,
  replay,
  turnNode,
  view,
  viewEvents,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { game as loopDemo } from "../demos/loop";
import { game as simultaneousDemo } from "../demos/simultaneous";
import { next, staged, stageNode } from "./flowShown";

test("a custom kind's show is published under its name", () => {
  // #region custom
  let state = init(staged, { players: ["p1"], seed: "s" });
  expect(view(staged, state, "p1").shown).toEqual({
    loop: { pass: 1 },
    stage: { name: "Setup" },
  });
  state = applyOrThrow(staged, state, next.by("p1"));
  expect(stageNode.shown(view(staged, state, "p1"))?.name).toBe("Play");
  // #endregion custom
});

test("the innermost node of a kind wins", () => {
  // #region innermost
  let state = init(loopDemo, { players: ["p1"], seed: "s" });
  state = applyOrThrow(loopDemo, state, loopDemo.action("low").by("p1"));
  // The outer loop is on its first pass, the inner one on its second
  expect(loopNode.shown(view(loopDemo, state, "p1"))).toEqual({ pass: 2 });
  // #endregion innermost
});

test("each player sees what their own fibers show", () => {
  // #region fibers
  const players = ["p1", "p2"];
  let state = init(simultaneousDemo, { players, seed: "s" });
  const roll = simultaneousDemo.action("roll");
  state = applyOrThrow(simultaneousDemo, state, roll.by("p1"));

  // One open prompt per fiber, in fiber order
  expect(view(simultaneousDemo, state, "p1").waiting).toEqual([
    { label: "Roll or stop", actors: ["p1"] },
    { label: "Roll or stop", actors: ["p2"] },
  ]);
  // But each player's `shown` is their own turn's
  expect(turnNode.shown(view(simultaneousDemo, state, "p1"))?.answers).toBe(1);
  expect(turnNode.shown(view(simultaneousDemo, state, "p2"))?.answers).toBe(0);
  // #endregion fibers
});

test("a flow event carries the new waiting and shown", () => {
  // #region events
  const players = ["p1", "p2"];
  const before = init(simultaneousDemo, { players, seed: "s" });
  const roll = simultaneousDemo.action("roll");
  const out = apply(simultaneousDemo, before, roll.by("p1"));
  if (!out.ok) throw new Error(out.reason);

  // p2's share: the flow as p2 sees it
  const mine = viewEvents(simultaneousDemo, out.events, "p2");
  expect(mine.find((e) => e.type === "flow")).toEqual({
    type: "flow",
    waiting: view(simultaneousDemo, out.state, "p2").waiting,
    shown: view(simultaneousDemo, out.state, "p2").shown,
  });
  // So replaying them onto p2's old view gives the new one
  expect(replay(view(simultaneousDemo, before, "p2"), mine)).toEqual(
    view(simultaneousDemo, out.state, "p2"),
  );
  // #endregion events
});
