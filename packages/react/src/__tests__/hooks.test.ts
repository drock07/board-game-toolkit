// @vitest-environment jsdom
import { viewEntities } from "@drock07/board-game-toolkit-engine";
import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { useGame, useGameEffect, useGameEvent } from "../hooks.js";
import { drawGame, drew, hand } from "./games.js";

test("useGame renders the view and plays events through useGameEvent and useGameEffect", async () => {
  const moved: number[] = [];
  const effects: { by: string; count: number }[] = [];
  const { result } = renderHook(() => {
    const g = useGame(drawGame, { players: ["p1", "p2"], seed: "s" });
    useGameEvent(g, "moved", (event, view) => {
      // Typed by the event type
      moved.push(
        event.entities.length,
        viewEntities(view, hand.of("p1")).length,
      );
    });
    // Typed by the effect: `d.count` is a number
    useGameEffect(
      g,
      drew,
      (d) => void effects.push({ by: d.by, count: d.count }),
    );
    return g;
  });
  expect(result.current.legal.map((i) => i.action)).toEqual([
    "draw",
    "drawTwo",
  ]);
  await act(async () => {
    result.current.submit(drawGame.action("drawTwo").by("p1"));
    await Promise.resolve();
  });
  expect(moved).toEqual([2, 2]);
  expect(effects).toEqual([{ by: "p1", count: 2 }]);
  expect(viewEntities(result.current.view, hand.of("p1"))).toHaveLength(2);
  expect(result.current.playing).toBe(false);
  expect(result.current.log.map((e) => e.type)).toEqual(["moved", "effect"]);
});

test("useGameEffect doesn't hear an effect whispered to someone else", async () => {
  const effects: unknown[] = [];
  const { result } = renderHook(() => {
    const g = useGame(drawGame, {
      players: ["p1", "p2"],
      seed: "s",
      viewer: "p2",
    });
    useGameEffect(g, drew, (d) => void effects.push(d));
    return g;
  });
  await act(async () => {
    result.current.submit(drawGame.action("draw").by("p1"));
    await Promise.resolve();
  });
  expect(effects).toEqual([]);
});

test("useGame renders on the server", () => {
  function Count() {
    const { view } = useGame(drawGame, { players: ["p1", "p2"], seed: "s" });
    return createElement(
      "span",
      null,
      viewEntities(view, hand.of("p1")).length,
    );
  }
  expect(renderToStaticMarkup(createElement(Count))).toBe("<span>0</span>");
});
