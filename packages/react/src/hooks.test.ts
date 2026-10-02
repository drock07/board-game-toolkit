// @vitest-environment jsdom
import {
  decision,
  defineGame,
  type AnyTypes,
  type GameImpl,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";
import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useGame, useGameEvent } from "./hooks.js";

const spec = {
  id: "counter",
  version: 1,
  players: { min: 1, max: 1 },
  zones: { pile: { visibility: "public" } },
  flow: decision("table", { actor: "p1" }, { add: { ends: false } }),
} as const satisfies GameSpec;

const game = defineGame({
  spec,
  impl: {
    setup() {},
    actions: { add: { execute: (tx) => void tx.create("chip", {}, "pile") } },
  } satisfies GameImpl<AnyTypes>,
});

test("useGame renders the view and plays events through useGameEvent", async () => {
  const seen: number[] = [];
  const { result } = renderHook(() => {
    const g = useGame(game, { players: ["p1"], seed: "s" });
    useGameEvent(g, "created", (_event, view) => {
      seen.push(view.zones.pile!.items.length);
    });
    return g;
  });
  expect(result.current.prompts).toHaveLength(1);
  await act(async () => {
    result.current.submit(result.current.legal[0]!);
    await Promise.resolve();
  });
  expect(seen).toEqual([1]);
  expect(result.current.view.zones.pile!.items).toHaveLength(1);
  expect(result.current.playing).toBe(false);
  expect(result.current.log.map((e) => e.type)).toContain("created");
});
