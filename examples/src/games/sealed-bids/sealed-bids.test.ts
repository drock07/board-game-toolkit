import {
  apply,
  init,
  legalInputs,
  randomBot,
  replay,
  type ApplyResult,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import {
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { sealedBids } from ".";
import { ITEMS, points, type Types } from "./impl";

type Result = ApplyResult<Types>;
const players = ["p1", "p2", "p3"];

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const bid = (r: Result, player: string, amount: number): Input => ({
  prompt: r.prompts.find((p) => p.actors[0] === player)!.id,
  player,
  action: "placeBid",
  args: { amount },
});

/** Everyone bids, in the given order. */
function round(r: Result, bids: [string, number][]): Result {
  for (const [p, amount] of bids)
    r = ok(apply(sealedBids, r.state, bid(r, p, amount)));
  return r;
}

describe("sealed bids", () => {
  test("every player is asked to bid at once", () => {
    const r = init(sealedBids, { players, seed: "s" });
    expect(r.prompts.map((p) => [p.node, p.actors])).toEqual([
      ["bid", ["p1"]],
      ["bid", ["p2"]],
      ["bid", ["p3"]],
    ]);
    expect(r.state.vars.lot).not.toBeNull();
    // Each player can bid 0 to 10, but only on their own prompt
    expect(legalInputs(sealedBids, r.state, "p2")).toHaveLength(11);
    expect(
      apply(sealedBids, r.state, { ...bid(r, "p1", 3), player: "p2" }),
    ).toMatchObject({
      ok: false,
      error: { code: "not_actor" },
    });
  });

  test("bids can come in any order; the round resolves once all are in", () => {
    let r = init(sealedBids, { players, seed: "s" });
    const lot = r.state.vars.lot!;
    r = ok(apply(sealedBids, r.state, bid(r, "p3", 4)));
    r = ok(apply(sealedBids, r.state, bid(r, "p1", 6)));
    expect(r.prompts.map((p) => p.actors[0])).toEqual(["p2"]);
    expect(r.state.vars.lastResult).toBeNull();
    r = ok(apply(sealedBids, r.state, bid(r, "p2", 2)));
    expect(r.state.vars.lastResult).toEqual({
      winner: "p1",
      item: lot,
      paid: 6,
    });
    expect(r.state.vars.coins).toEqual({ p1: 4, p2: 10, p3: 10 });
    // The next lot is up, and everyone bids again
    expect(r.prompts).toHaveLength(3);
  });

  test("ties go to the earlier seat; after three lots the most points win", () => {
    let r = init(sealedBids, { players, seed: "s" });
    r = round(r, [
      ["p1", 5],
      ["p2", 5],
      ["p3", 1],
    ]);
    expect(r.state.vars.lastResult!.winner).toBe("p1");
    r = round(r, [
      ["p1", 0],
      ["p2", 0],
      ["p3", 3],
    ]);
    r = round(r, [
      ["p1", 0],
      ["p2", 4],
      ["p3", 0],
    ]);
    expect(r.prompts[0]!.node).toBe("again");
    const scores = players.map((p) => points(r.state.vars, p));
    expect(scores.reduce((a, b) => a + b)).toBe(
      30 - 12 + ITEMS.reduce((t, i) => t + i.value, 0),
    );
    const best = Math.max(...scores);
    expect(r.state.vars.winners).toEqual(
      players.filter((_, i) => scores[i] === best),
    );
  });
});

test("golden replay", async () => {
  const { results, inputs } = playBots(sealedBids, {
    players,
    seed: "golden",
    bots: randomBot(),
    maxInputs: 40,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  expect(hashState(replay(sealedBids, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
