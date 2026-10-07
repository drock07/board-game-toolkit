// The reusing flow guide's claims.
import { init, view, type Spec } from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { bid, twoLots } from "./reusingFlow";

type SpecNode = Spec["flow"];

const ids = (n: SpecNode): string[] => [
  n.id,
  ...("children" in n && Array.isArray(n.children)
    ? (n.children as SpecNode[]).flatMap(ids)
    : []),
];

test("each use of a piece is lowered on its own, with its own node ids", () => {
  const all = ids(twoLots.spec.flow);
  expect(new Set(all).size).toBe(all.length);
  // Three steps in each auction, the shared one included, and the last
  expect(all.filter((id) => id.startsWith("step"))).toHaveLength(7);
});

test("the function's argument shapes each use", () => {
  let s = init(twoLots, { players: ["ann", "bob"], seed: "x" });
  expect(view(twoLots, s, "ann").waiting[0]?.label).toBe("Bid for the Crown");
  s = applyOrThrow(twoLots, s, bid.by("ann", { amount: 2 }));
  s = applyOrThrow(twoLots, s, bid.by("bob", { amount: 1 }));
  expect(view(twoLots, s, "ann").waiting[0]?.label).toBe("Bid for the Gem");
  s = applyOrThrow(twoLots, s, bid.by("ann", { amount: 0 }));
  s = applyOrThrow(twoLots, s, bid.by("bob", { amount: 3 }));
  expect(s.status).toBe("finished");
  expect(s.result).toEqual({ ann: ["Crown"], bob: ["Gem"] });
  expect(s.vars.log).toEqual(["tallied", "tallied"]);
});
