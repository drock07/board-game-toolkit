import {
  actors,
  apply,
  init,
  legalInputs,
  randomBot,
  replayInputs,
  view,
  type State,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { again, placeBid, sealedBids } from ".";
import { bid, ITEMS, points, sealed, type Vars } from "./game";

const players = ["p1", "p2", "p3"];

/** Everyone bids, in the given order. */
function round(s: State<Vars>, bids: [string, number][]): State<Vars> {
  for (const [p, amount] of bids)
    s = applyOrThrow(sealedBids, s, placeBid.by(p, { amount }));
  return s;
}

describe("sealed bids", () => {
  test("every player is asked to bid at once", () => {
    const s = init(sealedBids, { players, seed: "s" });
    expect(view(sealedBids, s, "p1").waiting).toEqual(
      players.map((p) => ({ label: "Place a sealed bid", actors: [p] })),
    );
    expect(actors(sealedBids, s)).toEqual(players);
    expect(s.vars.lot).not.toBeNull();
    // Each player can bid 0 to 10, once
    expect(legalInputs(sealedBids, s, "p2")).toHaveLength(11);
    const after = applyOrThrow(sealedBids, s, placeBid.by("p2", { amount: 3 }));
    expect(legalInputs(sealedBids, after, "p2")).toEqual([]);
    expect(apply(sealedBids, after, placeBid.by("p2", { amount: 1 })).ok).toBe(
      false,
    );
  });

  test("bids can come in any order; the round resolves once all are in", () => {
    let s = init(sealedBids, { players, seed: "s" });
    const lot = s.vars.lot!;
    s = round(s, [
      ["p3", 4],
      ["p1", 6],
    ]);
    expect(actors(sealedBids, s)).toEqual(["p2"]);
    // Bids are secret: each player sees only their own
    const seen = (viewer: string, p: string) => {
      const v = view(sealedBids, s, viewer);
      const e = v.entities[v.zones[sealed.of(p).id]![0]!]!;
      return bid.is(e) ? e.props.amount : "hidden";
    };
    expect(seen("p3", "p3")).toBe(4);
    expect(seen("p2", "p3")).toBe("hidden");
    expect(seen("p2", "p1")).toBe("hidden");
    expect(s.vars.lastResult).toBeNull();
    const out = apply(sealedBids, s, placeBid.by("p2", { amount: 2 }));
    if (!out.ok) throw new Error(out.reason);
    s = out.state;
    const sale = { winner: "p1", item: lot, paid: 6 };
    expect(s.vars.lastResult).toEqual(sale);
    expect(out.events).toContainEqual({
      type: "effect",
      name: "sold",
      data: sale,
    });
    expect(s.vars.coins).toEqual({ p1: 4, p2: 10, p3: 10 });
    // The next lot is up, last round's bids are gone, and everyone bids again
    expect(actors(sealedBids, s)).toEqual(players);
    for (const p of players) expect(s.zones[sealed.of(p).id]).toEqual([]);
  });

  test("ties go to the earlier seat; after three lots the most points win", () => {
    let s = init(sealedBids, { players, seed: "s" });
    s = round(s, [
      ["p1", 5],
      ["p2", 5],
      ["p3", 1],
    ]);
    expect(s.vars.lastResult!.winner).toBe("p1");
    s = round(s, [
      ["p1", 0],
      ["p2", 0],
      ["p3", 3],
    ]);
    s = round(s, [
      ["p1", 0],
      ["p2", 4],
      ["p3", 0],
    ]);
    expect(view(sealedBids, s, "p1").waiting).toEqual([
      { label: "Play again", actors: ["p1"] },
    ]);
    const scores = players.map((p) => points(s.vars, p));
    expect(scores.reduce((a, b) => a + b)).toBe(
      30 - 12 + ITEMS.reduce((t, i) => t + i.value, 0),
    );
    const best = Math.max(...scores);
    expect(s.vars.winners).toEqual(
      players.filter((_, i) => scores[i] === best),
    );
    // Playing again starts over with full coins
    s = applyOrThrow(sealedBids, s, again.by("p1"));
    expect(s.vars.coins).toEqual({ p1: 10, p2: 10, p3: 10 });
    expect(s.vars.items).toHaveLength(2);
    expect(actors(sealedBids, s)).toEqual(players);
  });
});

test("golden replay", async () => {
  const { states, inputs } = playBots(sealedBids, {
    players,
    seed: "golden",
    bots: randomBot("golden"),
    maxInputs: 40,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(sealedBids, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
