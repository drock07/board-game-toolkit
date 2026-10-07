import {
  actors,
  apply,
  init,
  legalInputs,
  randomBot,
  replayInputs,
  view,
  viewEvents,
  type EntityId,
  type State,
  type ZoneRef,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { again, crazyEights, drawCard, playCard, setColor, simpleBot } from ".";
import {
  canPlay,
  card,
  COLORS,
  deck,
  discard,
  hand,
  type Card,
  type Vars,
} from "./game";

const players = ["p1", "p2", "p3"];

const start = (seed = "s1") => init(crazyEights, { players, seed });
const ids = (s: State<Vars>, zone: ZoneRef) => s.zones[zone.id] ?? [];
const props = (s: State<Vars>, id: EntityId) => s.entities[id]!.props as Card;
const handOf = (s: State<Vars>, p: string) =>
  ids(s, hand.of(p)).map((id) => ({ id, props: props(s, id) }));
const top = (s: State<Vars>) => props(s, ids(s, discard)[0]!);
const playable = (s: State<Vars>, p: string) =>
  handOf(s, p)
    .filter((c) => canPlay(c.props, s.vars.activeColor, top(s)))
    .map((c) => c.id);
const waiting = (s: State<Vars>) => view(crazyEights, s, "p1").waiting;

/** The first seed whose opening deal satisfies `pred`. */
function findSeed(pred: (s: State<Vars>) => boolean): string {
  for (let i = 0; i < 500; i++) if (pred(start(`c${i}`))) return `c${i}`;
  throw new Error("No seed found");
}

/** Moves entities in a copy of the state, as a test fixture. */
function rearrange(
  s: State<Vars>,
  moves: { ids: readonly EntityId[]; to: ZoneRef; bottom?: boolean }[],
): State<Vars> {
  const next = structuredClone(s);
  for (const m of moves) {
    for (const zone of Object.keys(next.zones))
      next.zones[zone] = next.zones[zone]!.filter((id) => !m.ids.includes(id));
    const to = next.zones[m.to.id]!;
    next.zones[m.to.id] = m.bottom ? [...to, ...m.ids] : [...m.ids, ...to];
    for (const id of m.ids)
      next.entities[id] = { ...next.entities[id]!, zone: m.to.id };
  }
  return next;
}

describe("crazy eights", () => {
  test("deals seven each and turns one card up", () => {
    const s = start();
    for (const p of players) expect(ids(s, hand.of(p))).toHaveLength(7);
    expect(ids(s, discard)).toHaveLength(1);
    expect(ids(s, deck)).toHaveLength(64 - 21 - 1);
    expect(s.vars.activeColor).toBe(top(s).color);
    expect(waiting(s)).toEqual([{ label: "Play or draw", actors: ["p1"] }]);
  });

  test("legal plays are exactly the matching cards; drawing is only allowed without one", () => {
    const s = start(findSeed((s) => playable(s, "p1").length > 0));
    const legal = legalInputs(crazyEights, s, "p1");
    expect(
      legal
        .filter(playCard.is)
        .map((i) => i.args.card)
        .sort(),
    ).toEqual(playable(s, "p1").sort());
    expect(legal.some(drawCard.is)).toBe(false);
    expect(apply(crazyEights, s, drawCard.by("p1"))).toEqual({
      ok: false,
      reason: "You have a card you can play",
    });
    const bad = handOf(s, "p1").find((c) => !playable(s, "p1").includes(c.id));
    if (bad)
      expect(
        apply(crazyEights, s, playCard.by("p1", { card: bad.id })),
      ).toEqual({ ok: false, reason: "That card doesn't match" });
    // Only the current player may play
    expect(legalInputs(crazyEights, s, "p2")).toEqual([]);
  });

  test("an eight asks its player for a color, then play moves on", () => {
    let s = start(
      findSeed((s) => handOf(s, "p1").some((c) => c.props.value === 8)),
    );
    const eight = handOf(s, "p1").find((c) => c.props.value === 8)!;
    s = applyOrThrow(crazyEights, s, playCard.by("p1", { card: eight.id }));
    expect(waiting(s)).toEqual([{ label: "Call a color", actors: ["p1"] }]);
    expect(
      legalInputs(crazyEights, s, "p1").map((i) => i.args as unknown),
    ).toEqual(COLORS.map((color) => ({ color })));
    const color = COLORS.find((c) => c !== eight.props.color)!;
    s = applyOrThrow(crazyEights, s, setColor.by("p1", { color }));
    expect(s.vars.activeColor).toBe(color);
    expect(actors(crazyEights, s)).toEqual(["p2"]);
  });

  test("drawing ends the turn", () => {
    const seed = findSeed((s) => playable(s, "p1").length < 7);
    // Hand p1's playable cards to p2, so p1 must draw
    const s = rearrange(start(seed), [
      { ids: playable(start(seed), "p1"), to: hand.of("p2") },
    ]);
    const next = applyOrThrow(crazyEights, s, drawCard.by("p1"));
    expect(ids(next, hand.of("p1"))).toHaveLength(
      ids(s, hand.of("p1")).length + 1,
    );
    expect(actors(crazyEights, next)).toEqual(["p2"]);
  });

  test("drawing reshuffles the discards (keeping the top card) when the deck runs out", () => {
    // Empty the deck under the discard pile and hand p1's playable cards to
    // p2, so p1 must draw from an empty deck
    const seed = findSeed((s) => playable(s, "p1").length < 7);
    const dealt = start(seed);
    const s = rearrange(dealt, [
      { ids: ids(dealt, deck), to: discard, bottom: true },
      { ids: playable(dealt, "p1"), to: hand.of("p2") },
    ]);
    const topId = ids(s, discard)[0];
    const out = apply(crazyEights, s, drawCard.by("p1"));
    if (!out.ok) throw new Error(out.reason);
    const next = out.state;
    expect(ids(next, discard)).toEqual([topId]);
    expect(ids(next, deck)).toHaveLength(ids(s, discard).length - 2);
    expect(ids(next, hand.of("p1"))).toHaveLength(
      ids(s, hand.of("p1")).length + 1,
    );
    expect(
      out.events.some((e) => e.type === "shuffled" && e.zone === deck.id),
    ).toBe(true);
  });

  test("the first empty hand wins; playing again deals a fresh game", () => {
    const { states } = playBots(crazyEights, {
      players,
      seed: "game",
      bots: simpleBot,
      maxInputs: 500,
    });
    let s = states.at(-1)!;
    expect(waiting(s)).toEqual([{ label: "Play again", actors: ["p1"] }]);
    const winner = s.vars.winner!;
    expect(ids(s, hand.of(winner))).toHaveLength(0);
    s = applyOrThrow(crazyEights, s, again.by("p1"));
    expect(s.vars.winner).toBeNull();
    for (const p of players) expect(ids(s, hand.of(p))).toHaveLength(7);
    expect(ids(s, discard)).toHaveLength(1);
  });
});

test("from p2's view, p1's cards never show, and the discard shows only its top", () => {
  const { states, inputs } = playBots(crazyEights, {
    players,
    seed: "views",
    bots: simpleBot,
    maxInputs: 200,
  });
  let checked = 0;
  for (let i = 1; i < states.length; i++) {
    const before = states[i - 1]!;
    const out = apply(crazyEights, before, inputs[i - 1]!);
    if (!out.ok) throw new Error(out.reason);
    const after = out.state;
    // Cards in p1's hand now never show in p2's view; cards p1 held both
    // before and after never show in that input's events
    const held = ids(after, hand.of("p1"));
    const heldThroughout = held.filter((id) =>
      ids(before, hand.of("p1")).includes(id),
    );
    const v = view(crazyEights, after, "p2");
    const shown = JSON.stringify(v);
    const events = JSON.stringify(viewEvents(crazyEights, out.events, "p2"));
    for (const id of held) {
      expect(shown).not.toContain(`"${id}"`);
      checked++;
    }
    for (const id of heldThroughout) expect(events).not.toContain(`"${id}"`);
    // p2 does see their own hand
    for (const id of ids(after, hand.of("p2")))
      expect(shown).toContain(`"${id}"`);
    // Only the discard's top card shows
    const pile = v.zones[discard.id]!.map((ref) => v.entities[ref]!);
    expect(card.is(pile[0]!)).toBe(true);
    expect(pile.slice(1).every((e) => "hidden" in e)).toBe(true);
  }
  expect(checked).toBeGreaterThan(100);
});

test("golden replay", async () => {
  const { states, inputs } = playBots(crazyEights, {
    players,
    seed: "golden",
    bots: { p1: randomBot("golden"), p2: simpleBot, p3: simpleBot },
    maxInputs: 150,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(crazyEights, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
