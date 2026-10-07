import { FlowGraph } from "@drock07/board-game-toolkit-react/devtools";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { games } from "./registry";

test.each(Object.entries(games))(
  "the flow graph draws every node of %s",
  (_, game) => {
    const html = renderToStaticMarkup(createElement(FlowGraph, { game }));
    const drawn = [...html.matchAll(/data-node="([^"]+)"/g)].map((m) => m[1]);
    // Every node in the spec: the flow, abilities and effects, by id
    const ids = new Set<string>();
    const walk = (n: { id: string; kind: string }) => {
      ids.add(n.id);
      for (const c of game.kinds[n.kind]!.children(n)) walk(c);
    };
    for (const root of [
      game.spec.flow,
      ...(game.spec.abilities ?? []),
      ...(game.spec.effects ?? []),
    ])
      walk(root);
    expect(drawn.sort()).toEqual([...ids].sort());
  },
);
