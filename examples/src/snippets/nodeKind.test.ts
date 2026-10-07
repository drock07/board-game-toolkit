// The node kinds guide's claims, on its two custom kinds.
import { actors, init, view } from "@drock07/board-game-toolkit-engine";
import { applyOrThrow, fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { game, ready, repeatNode, rollCallNode } from "./nodeKind";

const players = ["ann", "bob", "cat"];

test("rollCall waits on everyone its query names, in any order, once each", () => {
  let s = init(game, { players, seed: "x" });
  // bob is away, so only ann and cat are asked
  expect(actors(game, s)).toEqual(["ann", "cat"]);
  expect(view(game, s, "bob").waiting).toEqual([
    { label: "Ready?", actors: ["ann", "cat"] },
  ]);
  s = applyOrThrow(game, s, ready.by("cat"));
  expect(actors(game, s)).toEqual(["ann"]);
  expect(rollCallNode.shown(view(game, s, "bob"))).toEqual({
    answered: ["cat"],
  });
  s = applyOrThrow(game, s, ready.by("ann"));
  expect(rollCallNode.shown(view(game, s, "bob"))).toBeUndefined();
});

test("repeat runs its body three times, and the body reads its pass", () => {
  let s = init(game, { players, seed: "x" });
  s = applyOrThrow(game, s, ready.by("ann"));
  s = applyOrThrow(game, s, ready.by("cat"));
  expect(repeatNode.shown(view(game, s, "ann"))).toEqual({ pass: 1, of: 3 });
  for (let i = 0; i < 3; i++)
    s = applyOrThrow(game, s, game.action("tick").by("ann"));
  expect(s.vars.log).toEqual([
    "ann is ready",
    "cat is ready",
    "pass 1",
    "pass 2",
    "pass 3",
  ]);
  expect(s.status).toBe("finished");
});

test("the kinds are in the spec under their names", () => {
  const kinds = JSON.stringify(game.spec.flow);
  expect(kinds).toContain('"kind":"rollCall"');
  expect(kinds).toContain('"kind":"repeat"');
});

test("fuzz: the custom kinds replay and never leak", () => {
  const report = fuzz(game, { seeds: 20, players, maxInputs: 20 });
  expect(report.failures).toEqual([]);
  expect(report.finished).toBe(20);
});
