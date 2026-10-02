import { describe, expect, test } from "vitest";
import { decision, loop } from "./builders.js";
import { defineGame, init, type Game } from "./game.js";
import type { GameImpl } from "./impl.js";
import type { Json } from "./json.js";
import type { GameSpec } from "./spec.js";
import { transact } from "./tx.js";
import type { AnyTypes } from "./types.js";
import { isHidden, view, viewEvents, type PlayerView } from "./view.js";

const spec = {
  id: "views",
  version: 1,
  players: { min: 2, max: 2 },
  zones: {
    deck: { visibility: "hidden" },
    backs: { visibility: "hidden", revealType: true },
    table: { visibility: "public" },
    pile: { visibility: "top" },
    hand: { perPlayer: true, visibility: "owner" },
    odd: { visibility: { ref: "oddOnly" } },
  },
  vars: {
    score: {},
    secret: { visibility: "hidden" },
    mine: { visibility: "owner" },
  },
  flow: loop(
    "session",
    decision("turn", { actor: "p1" }, { go: {} }, { locals: "turnLocals" }),
  ),
} as const satisfies GameSpec;

type Vars = { score: number; secret: string; mine: Record<string, number> };
type Types = Omit<AnyTypes, "vars"> & { vars: Vars };

const game = defineGame({
  spec,
  impl: {
    setup(tx) {
      tx.vars = { score: 1, secret: "s3cret", mine: { p1: 1, p2: 2 } };
      for (let i = 0; i < 3; i++) tx.create("card", { n: i }, "deck");
      tx.create("card", { n: 10 }, "backs");
      tx.create("card", { n: 20 }, "table");
      tx.create("card", { n: 30 }, "pile");
      tx.create("card", { n: 31 }, "pile");
      tx.create("card", { n: 40 }, "hand:p1");
      tx.create("card", { n: 41 }, "odd");
      tx.create("card", { n: 42 }, "odd");
    },
    locals: { turnLocals: () => ({ rolled: 3 }) },
    visibility: {
      oddOnly: (_s, e) => (e.props as { n: number }).n % 2 === 1,
    },
    actions: { go: { execute: () => {} } },
  } satisfies GameImpl<Types>,
}) as unknown as Game<Types>;

const start = () => init(game, { players: ["p1", "p2"], seed: "s" });
const visible = (v: PlayerView<Types>) =>
  Object.values(v.entities)
    .filter((e) => !isHidden(e))
    .map((e) => (e as { props: Json }).props);

describe("view", () => {
  test("zone visibility: public, hidden, owner, top and custom", () => {
    const r = start();
    const p1 = view(game, r.state, "p1");
    const p2 = view(game, r.state, "p2");
    expect(visible(p1)).toEqual(
      expect.arrayContaining([{ n: 20 }, { n: 30 }, { n: 40 }, { n: 41 }]),
    );
    expect(visible(p1)).toHaveLength(4);
    expect(visible(p2)).toEqual(
      expect.arrayContaining([{ n: 20 }, { n: 30 }, { n: 41 }]),
    );
    expect(visible(p2)).toHaveLength(3);
    expect(p2.zones["hand:p1"]!.items).toEqual(["?hand:p1#0"]);
    expect(p2.entities["?hand:p1#0"]).toEqual({
      id: "?hand:p1#0",
      hidden: true,
      zone: "hand:p1",
    });
    // Only the top of a "top" zone shows
    expect(p2.zones.pile!.items).toEqual(["card#5", "?pile#1"]);
    expect(visible(view(game, r.state, "spectator"))).toHaveLength(3);
  });

  test("hidden ids are positional, so a shuffle reveals nothing", () => {
    const r = start();
    const before = view(game, r.state, "p1").zones.deck!.items;
    const shuffled = transact(r.state, (tx) => tx.shuffle("deck")).state;
    expect(view(game, shuffled, "p1").zones.deck!.items).toEqual(before);
    expect(before).toEqual(["?deck#0", "?deck#1", "?deck#2"]);
  });

  test("revealType shows a hidden entity's type", () => {
    expect(view(game, start().state, "p1").entities["?backs#0"]).toEqual({
      id: "?backs#0",
      hidden: true,
      zone: "backs",
      type: "card",
    });
  });

  test("faceUp overrides the zone both ways", () => {
    const r = start();
    const flipped = transact(r.state, (tx) => {
      tx.flip("card#0", true); // face up in the hidden deck
      tx.flip("card#4", false); // face down on the public table
    }).state;
    const v = view(game, flipped, "p2");
    expect(v.zones.deck!.items).toEqual(["card#0", "?deck#1", "?deck#2"]);
    expect(v.zones.table!.items).toEqual(["?table#0"]);
  });

  test("vars follow their visibility; prompts and internals are trimmed", () => {
    const r = start();
    const p1 = view(game, r.state, "p1");
    const p2 = view(game, r.state, "p2");
    expect(p1.vars).toEqual({ score: 1, mine: { p1: 1 } });
    expect(p2.vars).toEqual({ score: 1, mine: { p2: 2 } });
    expect(view(game, r.state, "spectator").vars).toEqual({
      score: 1,
      mine: {},
    });
    expect(p1.prompts[0]).toMatchObject({
      actors: ["p1"],
      actions: [{ name: "go" }],
    });
    expect(p2.prompts[0]).toEqual({
      id: "q1",
      node: "turn",
      kind: "decision",
      actors: ["p1"],
    });
    expect(p1.locals).toEqual({ turn: { rolled: 3 } });
    expect("rng" in p1 || "flow" in p1).toBe(false);
  });
});

describe("viewEvents", () => {
  test("a draw shows the drawer the card and others an opaque id", () => {
    const r = start();
    const { events } = transact(r.state, (tx) => {
      tx.moveTop("deck", "hand:p2");
      tx.shuffle("deck");
    });
    const forP2 = viewEvents(game, r.state, events, "p2");
    const forP1 = viewEvents(game, r.state, events, "p1");
    expect(forP2[0]).toMatchObject({
      type: "moved",
      ids: ["card#0"],
      to: "hand:p2",
    });
    expect(forP1[0]).toMatchObject({
      type: "moved",
      ids: ["?hand:p2#0"],
      to: "hand:p2",
    });
    expect(forP1[1]).toMatchObject({
      type: "shuffled",
      order: ["?deck#0", "?deck#1"],
    });
  });

  test("custom events respect visibleTo; vars patches follow var visibility", () => {
    const r = start();
    const { events } = transact(r.state, (tx) => {
      tx.emit("whisper", "hi", ["p1"]);
      tx.vars.secret = "changed";
      tx.vars.mine.p1 = 5;
      tx.vars.mine.p2 = 6;
      tx.vars.score = 2;
    });
    const forP2 = viewEvents(game, r.state, events, "p2");
    expect(forP2.find((e) => e.type === "custom")).toBeUndefined();
    const vars = forP2.find((e) => e.type === "vars");
    expect(
      vars && vars.type === "vars" && vars.patches.map((p) => p.path),
    ).toEqual([["mine", "p2"], ["score"]]);
    expect(
      viewEvents(game, r.state, events, "p1").some((e) => e.type === "custom"),
    ).toBe(true);
  });

  test("created and flipped entities stay opaque until visible", () => {
    const r = start();
    const { events } = transact(r.state, (tx) => {
      tx.create("card", { n: 99 }, "deck", { at: "top" });
      tx.flip("card#1", true);
    });
    const forP2 = viewEvents(game, r.state, events, "p2");
    expect(forP2[0]).toMatchObject({
      type: "created",
      id: "?deck#0",
      entity: { hidden: true },
    });
    expect(JSON.stringify(forP2[0])).not.toContain("99");
    expect(forP2[1]).toMatchObject({ type: "flipped", id: "card#1" });
  });
});
