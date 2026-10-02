import {
  apply,
  init,
  legalInputs,
  randomBot,
  replay,
  view,
  viewEvents,
  type ApplyResult,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import {
  checkInvariants,
  hashState,
  playBots,
  transact,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { crazyEights, simpleBot } from ".";
import { canPlay, COLORS, hand, playable, topCard, type Types } from "./impl";

type Result = ApplyResult<Types>;
const players = ["p1", "p2", "p3"];

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const start = (seed = "s1") => init(crazyEights, { players, seed });
const prompt = (r: Result) => r.prompts[0]!;
const act = (r: Result, action: string, args?: { card: string }): Input => ({
  prompt: prompt(r).id,
  player: prompt(r).actors[0]!,
  action,
  ...(args ? { args } : {}),
});

/** The first seed whose opening hand for p1 satisfies `pred`. */
function findSeed(pred: (r: Result) => boolean): string {
  for (let i = 0; i < 500; i++) if (pred(start(`c${i}`))) return `c${i}`;
  throw new Error("No seed found");
}

describe("crazy eights", () => {
  test("deals seven each and turns one card up", () => {
    const r = start();
    for (const p of players)
      expect(r.state.zones[`hand:${p}`]!.items).toHaveLength(7);
    expect(r.state.zones.discard.items).toHaveLength(1);
    expect(r.state.zones.deck.items).toHaveLength(64 - 21 - 1);
    expect(r.state.vars.activeColor).toBe(topCard(r).color);
    expect(prompt(r)).toMatchObject({ node: "turn", actors: ["p1"] });
  });

  test("legal plays are exactly the matching cards; drawing is only allowed without one", () => {
    const seed = findSeed((r) => playable(r, "p1").length > 0);
    const r = start(seed);
    const top = topCard(r);
    const legal = legalInputs(crazyEights, r.state, "p1");
    const plays = legal.flatMap((i) =>
      "args" in i ? [(i.args as { card: string }).card] : [],
    );
    expect(plays.sort()).toEqual(
      hand(r, "p1")
        .filter((e) => canPlay(e.props, r.state.vars.activeColor, top))
        .map((e) => e.id)
        .sort(),
    );
    expect(legal.some((i) => "action" in i && i.action === "drawCard")).toBe(
      false,
    );
    expect(apply(crazyEights, r.state, act(r, "drawCard"))).toMatchObject({
      ok: false,
      error: { message: "You have a card you can play" },
    });
    const bad = hand(r, "p1").find((e) => !plays.includes(e.id));
    if (bad) {
      expect(
        apply(crazyEights, r.state, act(r, "playCard", { card: bad.id })),
      ).toMatchObject({
        ok: false,
        error: { message: "That card doesn't match" },
      });
    }
  });

  test("an eight asks its player for a color, then play moves on", () => {
    const seed = findSeed((r) =>
      hand(r, "p1").some((e) => e.props.value === 8),
    );
    let r = start(seed);
    const eight = hand(r, "p1").find((e) => e.props.value === 8)!;
    r = ok(apply(crazyEights, r.state, act(r, "playCard", { card: eight.id })));
    expect(prompt(r)).toMatchObject({
      kind: "choose",
      node: "wildColor",
      actors: ["p1"],
      options: [...COLORS],
    });
    const color = COLORS.find((c) => c !== eight.props.color)!;
    r = ok(
      apply(crazyEights, r.state, {
        prompt: prompt(r).id,
        player: "p1",
        choose: [color],
      }),
    );
    expect(r.state.vars.activeColor).toBe(color);
    expect(prompt(r)).toMatchObject({ node: "turn", actors: ["p2"] });
  });

  test("drawing reshuffles the discards (keeping the top card) when the deck runs out", () => {
    // p1 holds some unplayable cards; empty the deck under the discard pile
    // and hand p1's playable cards to p2, so p1 must draw from an empty deck
    const seed = findSeed((r) => playable(r, "p1").length < 7);
    const dealt = start(seed);
    const { state } = transact(dealt.state, (tx) => {
      tx.move(tx.state.zones.deck.items, "discard", { at: "bottom" });
      tx.move(playable(tx, "p1"), "hand:p2");
    });
    const r = { ...dealt, state };
    const top = state.zones.discard.items[0];
    const next = ok(apply(crazyEights, state, act(r, "drawCard")));
    expect(next.state.zones.discard.items).toEqual([top]);
    expect(next.state.zones.deck.items).toHaveLength(
      state.zones.discard.items.length - 2,
    );
    expect(hand(next, "p1")).toHaveLength(hand(r, "p1").length + 1);
    expect(
      next.events.some((e) => e.type === "shuffled" && e.zone === "deck"),
    ).toBe(true);
    expect(checkInvariants(next.state)).toEqual([]);
  });

  test("the first empty hand wins; playing again deals a fresh game", () => {
    const { results } = playBots(crazyEights, {
      players,
      seed: "game",
      bots: simpleBot,
      maxInputs: 500,
    });
    let r = results.at(-1)!;
    expect(prompt(r).node).toBe("again");
    const winner = r.state.vars.winner!;
    expect(hand(r, winner)).toHaveLength(0);
    r = ok(
      apply(crazyEights, r.state, {
        prompt: prompt(r).id,
        player: "p2",
        continue: true,
      }),
    );
    expect(r.state.vars.winner).toBeNull();
    for (const p of players) expect(hand(r, p)).toHaveLength(7);
  });
});

test("from p2's view, p1's cards never show (M6 acceptance)", () => {
  const { results } = playBots(crazyEights, {
    players,
    seed: "views",
    bots: simpleBot,
    maxInputs: 200,
  });
  let checked = 0;
  for (let i = 1; i < results.length; i++) {
    const before = results[i - 1]!.state;
    const after = results[i]!;
    // Cards in p1's hand now never show in p2's view; cards p1 held both
    // before and after a step never show in that step's events
    const held = after.state.zones["hand:p1"]!.items;
    const heldThroughout = held.filter((id) =>
      before.zones["hand:p1"]!.items.includes(id),
    );
    const v = JSON.stringify(view(crazyEights, after.state, "p2"));
    const events = JSON.stringify(
      viewEvents(crazyEights, before, after.events, "p2"),
    );
    for (const id of held) {
      expect(v).not.toContain(`"${id}"`);
      checked++;
    }
    for (const id of heldThroughout) expect(events).not.toContain(`"${id}"`);
    // p2 does see their own hand
    for (const id of after.state.zones["hand:p2"]!.items)
      expect(v).toContain(`"${id}"`);
  }
  expect(checked).toBeGreaterThan(100);
  // The discard pile shows only its top card
  const last = view(crazyEights, results.at(-1)!.state, "p2");
  expect(
    last.zones.discard.items.slice(1).every((id) => id.startsWith("?discard#")),
  ).toBe(true);
});

test("golden replay", async () => {
  const { results, inputs } = playBots(crazyEights, {
    players,
    seed: "golden",
    bots: { p1: randomBot(), p2: simpleBot, p3: simpleBot },
    maxInputs: 150,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  expect(hashState(replay(crazyEights, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
