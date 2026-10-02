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
    expect(drawn.sort()).toEqual([...game.nodes.keys()].sort());
  },
);
