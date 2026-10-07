// The simultaneous turns guide's claims.
import {
  actors,
  defaultNodes,
  define,
  init,
  legalInputs,
  turnNode,
  view,
  type State,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow, fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { game as rollAtOnce } from "../demos/simultaneous";
import { placeBid, sealed, sealedBids } from "../games/sealed-bids/game";
import { drawAtOnce, drawAtOnceHeld, type Vars } from "./simultaneousTurns";

const players = ["ann", "bob"];
const actionsOf = (g: typeof drawAtOnce, s: State<Vars>, p: string): string[] =>
  legalInputs(g, s, p)
    .map((i) => i.action)
    .sort();

/** ann draws until she draws a trap. */
function annHitsATrap(g: typeof drawAtOnce) {
  let s = init(g, { players, seed: "x" });
  while (!actionsOf(g, s, "ann").includes("disarm"))
    s = applyOrThrow(g, s, g.action("draw").by("ann"));
  return s;
}

test("everyone acts at once, in any order", () => {
  const s = init(drawAtOnce, { players, seed: "x" });
  expect(actors(drawAtOnce, s)).toEqual(["ann", "bob"]);
  expect(view(drawAtOnce, s, "ann").waiting).toEqual([
    { label: "Draw or stop", actors: ["ann"] },
    { label: "Draw or stop", actors: ["bob"] },
  ]);
});

test("a reaction pauses only the fiber that caused it", () => {
  const s = annHitsATrap(drawAtOnce);
  expect(actionsOf(drawAtOnce, s, "ann")).toEqual(["disarm"]);
  expect(actionsOf(drawAtOnce, s, "bob")).toEqual(["draw", "stop"]);
});

test('pause: "everyone" holds every other fiber', () => {
  let s = annHitsATrap(drawAtOnceHeld);
  expect(actors(drawAtOnceHeld, s)).toEqual(["ann"]);
  expect(actionsOf(drawAtOnceHeld, s, "bob")).toEqual([]);
  s = applyOrThrow(
    drawAtOnceHeld,
    s,
    drawAtOnceHeld.action("disarm").by("ann"),
  );
  expect(actionsOf(drawAtOnceHeld, s, "bob")).toEqual(["draw", "stop"]);
});

test("each player sees their own fiber's turn counts, not anyone else's", () => {
  let s = init(rollAtOnce, { players, seed: "x" });
  s = applyOrThrow(rollAtOnce, s, rollAtOnce.action("roll").by("ann"));
  s = applyOrThrow(rollAtOnce, s, rollAtOnce.action("roll").by("ann"));
  expect(turnNode.shown(view(rollAtOnce, s, "ann"))?.counts).toEqual({
    roll: 2,
  });
  expect(turnNode.shown(view(rollAtOnce, s, "bob"))?.counts).toEqual({});
});

test("sealed bids stay sealed until the round resolves", () => {
  let s = init(sealedBids, { players, seed: "x" });
  s = applyOrThrow(sealedBids, s, placeBid.by("ann", { amount: 4 }));
  const bobs = view(sealedBids, s, "bob");
  const [annsBid] = bobs.zones[sealed.of("ann").id]!;
  expect(bobs.entities[annsBid!]).toMatchObject({ hidden: true });
  expect(actors(sealedBids, s)).toEqual(["bob"]);
});

test("inside a fiber, s.actor is its player, so a branch can sit some out", () => {
  const { rules, action, branch, simultaneous, prompt, seq, step } = define<{
    out: string[];
    answered: string[];
  }>().withNodes(defaultNodes);
  const g = rules({
    players: 3,
    setup: (tx) => void (tx.vars = { out: ["bob"], answered: [] }),
    flow: seq(
      simultaneous(
        branch([
          {
            when: (s) => !s.vars.out.includes(s.actor!),
            then: prompt(
              action("go", {
                execute: (tx, actor) => void tx.vars.answered.push(actor),
              }),
            ),
          },
        ]),
      ),
      step((tx) => tx.end()),
    ),
  });
  const s = init(g, { players: ["ann", "bob", "cat"], seed: "x" });
  expect(actors(g, s)).toEqual(["ann", "cat"]);
});

test("fuzz: both versions replay and never leak", () => {
  for (const g of [drawAtOnce, drawAtOnceHeld]) {
    const report = fuzz(g, {
      seeds: 30,
      players: ["a", "b", "c"],
      maxInputs: 80,
    });
    expect(report.failures).toEqual([]);
  }
});
