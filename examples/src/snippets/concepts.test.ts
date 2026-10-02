// Code from the Concepts pages, run as tests so the pages can't go stale.
import {
  apply,
  init,
  isHidden,
  reduceEvents,
  replay,
  view,
  viewEvents,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import { transact } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { crazyEights } from "../games/crazy-eights";
import { sandbox } from "../games/sandbox";

const players = ["p1", "p2", "p3"];

test("state", () => {
  // #region state
  const { state } = init(crazyEights, { players, seed: "s1" });

  state.players; // ["p1", "p2", "p3"], in seat order
  Object.keys(state.zones); // ["deck", "discard", "hand:p1", "hand:p2", "hand:p3"]
  state.zones["hand:p1"]!.items; // 7 entity ids, top first: ["card#9", "card#40", ...]
  state.entities["card#9"]; // { id: "card#9", type: "card", props: { color: "red", value: 5 }, zone: "hand:p1" }
  state.vars.activeColor; // "yellow"
  // #endregion state
  expect(Object.keys(state.zones)).toEqual([
    "deck",
    "discard",
    "hand:p1",
    "hand:p2",
    "hand:p3",
  ]);
  expect(state.zones["hand:p1"]!.items).toHaveLength(7);
  expect(state.zones["hand:p1"]!.items.slice(0, 2)).toEqual([
    "card#9",
    "card#40",
  ]);
  expect(state.entities["card#9"]).toEqual({
    id: "card#9",
    type: "card",
    props: { color: "red", value: 5 },
    zone: "hand:p1",
  });
  expect(state.vars.activeColor).toBe("yellow");
});

test("transactions and events", () => {
  const { state } = init(sandbox, { players: ["p1"], seed: "s1" });
  // #region tx
  const { state: next, events } = transact(state, (tx) => {
    tx.moveTop("deck", "hand", 2);
    tx.shuffle("deck");
  });
  events.map((e) => e.type); // ["moved", "shuffled"]
  // `state` is unchanged; `next` shares everything the ops didn't touch
  // #endregion tx
  expect(events.map((e) => e.type)).toEqual(["moved", "shuffled"]);
  expect(state.zones.hand.items).toHaveLength(0);
  expect(next.zones.hand.items).toHaveLength(2);
  expect(next.entities).not.toBe(state.entities);

  // #region reduce
  // Replaying the events onto the old state gives the new one
  const rebuilt = reduceEvents(state, events);
  // rebuilt.zones, .entities and .vars equal next's
  // #endregion reduce
  expect(rebuilt.zones).toEqual(next.zones);
});

test("views", () => {
  const { state } = init(crazyEights, { players, seed: "s1" });
  // #region view
  const mine = view(crazyEights, state, "p1");
  const theirs = mine.zones["hand:p2"]!.items; // ["?hand:p2#0", "?hand:p2#1", ...]
  const card = mine.entities[theirs[0]!]!;
  if (isHidden(card)) {
    card; // { id: "?hand:p2#0", hidden: true, zone: "hand:p2" }
  }
  mine.zones["hand:p1"]!.items; // real ids: my own hand is visible to me
  // #endregion view
  expect(theirs[0]).toBe("?hand:p2#0");
  expect(card).toEqual({ id: "?hand:p2#0", hidden: true, zone: "hand:p2" });
  const own = mine.zones["hand:p1"]!.items[0]!;
  expect(isHidden(mine.entities[own]!)).toBe(false);
});

test("view events", () => {
  const start = init(sandbox, { players: ["p1"], seed: "s1" });
  const prompt = start.prompts[0]!;
  const res = apply(sandbox, start.state, {
    prompt: prompt.id,
    player: "p1",
    action: "draw",
  });
  if (!res.ok) throw new Error(res.error.message);
  // #region viewEvents
  // What a spectator sees of a draw: the card's id is real only if they can
  // see it before or after the move. The hand is public, so it is.
  const seen = viewEvents(sandbox, start.state, res.events, "spectator");
  // #endregion viewEvents
  const moved = seen.find((e) => e.type === "moved")!;
  expect(moved.type === "moved" && moved.ids[0]!.startsWith("card#")).toBe(
    true,
  );
});

test("determinism", () => {
  // #region replay
  const opts = { players, seed: "s1" };
  const inputs: Input[] = [];
  let res = init(crazyEights, opts);
  // ... each input you apply, you also record
  const prompt = res.prompts[0]!;
  const draw: Input = {
    prompt: prompt.id,
    player: prompt.actors[0]!,
    action: "drawCard",
  };
  const next = apply(crazyEights, res.state, draw);
  if (next.ok) {
    inputs.push(draw);
    res = next;
  }

  // Later, anywhere: the seed and the inputs rebuild the same state
  const again = replay(crazyEights, { ...opts, inputs });
  // again deep-equals res.state
  // #endregion replay
  expect(again).toEqual(res.state);

  // #region save
  // State is plain JSON, so saving is JSON.stringify
  const saved = JSON.stringify(res.state);
  const loaded = JSON.parse(saved) as typeof res.state;
  // `apply` continues from a loaded state like any other
  // #endregion save
  expect(loaded).toEqual(res.state);
});
