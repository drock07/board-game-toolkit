// The Hidden information guide's claims: owner and top zones, placeholders
// keyed by ref, refs renewed by a shuffle, a face-down card in a public zone,
// and a carried ability in a hidden hand giving itself away through actors.
import {
  actors,
  init,
  legalInputs,
  view,
  viewEntities,
  type State,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { blackjack, placeBet, stand } from "../games/blackjack";
import { dealer, type Vars as BlackjackVars } from "../games/blackjack/game";
import { crazyEights } from "../games/crazy-eights";
import { card, deck, discard, hand } from "../games/crazy-eights/game";
import { leaky, safe } from "./hidden-information";

const players = ["p1", "p2", "p3"];

test("owner zones, top zones and placeholders", () => {
  const state = init(crazyEights, { players, seed: "hidden" });
  // #region views
  const v = view(crazyEights, state, "p2");
  viewEntities(v, hand.of("p2")).filter(card.is); // p2's seven cards, with props
  viewEntities(v, hand.of("p1")); // seven placeholders: { ref, zone, hidden: true }
  viewEntities(v, discard)[0]; // the top card, face up for everyone
  viewEntities(v, deck).length; // 42: everyone may count the deck
  // #endregion views
  expect(viewEntities(v, hand.of("p2")).filter(card.is)).toHaveLength(7);
  const theirs = viewEntities(v, hand.of("p1"));
  expect(theirs).toHaveLength(7);
  for (const e of theirs)
    expect(e).toEqual({ ref: e.ref, zone: "hand:p1", hidden: true });
  expect(card.is(viewEntities(v, discard)[0]!)).toBe(true);
  expect(viewEntities(v, deck)).toHaveLength(42);
  // A spectator sees only what's public
  const spectator = view(crazyEights, state, "spectator");
  expect(viewEntities(spectator, hand.of("p2")).some(card.is)).toBe(false);
  expect(card.is(viewEntities(spectator, discard)[0]!)).toBe(true);
});

test("a shuffle renews refs, so a card can't be followed through it", () => {
  const state = init(crazyEights, { players, seed: "hidden" });
  // The deal shuffled the deck: its refs are all newer than any hand's
  const v = view(crazyEights, state, "p2");
  const num = (ref: string) => Number(ref.slice(1));
  const inDeck = v.zones[deck.id]!.map(num);
  const inHand = v.zones[hand.of("p1").id]!.map(num);
  expect(Math.min(...inDeck)).toBeGreaterThan(Math.max(...inHand));
  // And a placeholder never carries the entity's id
  const hidden = Object.values(v.entities).filter((e) => "hidden" in e);
  expect(hidden.length).toBeGreaterThan(0);
  expect(JSON.stringify(hidden)).not.toContain("card#");
  expect(Object.keys(v.entities).every((ref) => ref.startsWith("r"))).toBe(
    true,
  );
});

test("a face-down card in a public zone, then flipped", () => {
  // A seed whose opening hand isn't a natural, so play reaches "Hit or stand"
  let s: State<BlackjackVars> | undefined;
  for (let i = 0; i < 50 && !s; i++) {
    const dealt = applyOrThrow(
      blackjack,
      init(blackjack, { players: ["p1"], seed: `bj${i}` }),
      placeBet.by("p1", { amount: 10 }),
    );
    if (view(blackjack, dealt, "p1").waiting[0]?.label === "Hit or stand")
      s = dealt;
  }
  if (!s) throw new Error("No seed found");
  const before = viewEntities(view(blackjack, s, "p1"), dealer);
  expect(before.map((e) => "hidden" in e)).toEqual([false, true]);
  const after = applyOrThrow(blackjack, s, stand.by("p1"));
  const shown = viewEntities(view(blackjack, after, "p1"), dealer);
  expect(shown.every((e) => !("hidden" in e))).toBe(true);
});

test("a carried ability in a hidden hand gives itself away; asking always doesn't", () => {
  // p2 holds the Counter. With the carried ability, p2 is asked to respond…
  let s = init(leaky, { players: ["p1", "p2"], seed: "x" });
  const play = (action: string, player: string) => {
    const input = legalInputs(leaky, s, player).find(
      (i) => i.action === action,
    );
    s = applyOrThrow(leaky, s, input!);
  };
  play("strike", "p1");
  expect(view(leaky, s, "p1").waiting).toEqual([
    { label: "Respond to the attack", actors: ["p2"] },
  ]);
  // …and when p2 strikes p1, who holds no Counter, p1 isn't asked
  play("takeIt", "p2");
  play("strike", "p2");
  expect(actors(leaky, s)).toEqual(["p1"]);
  expect(view(leaky, s, "p1").waiting[0]!.label).toBe("Strike");

  // The game-wide ability asks the target every time, whatever they hold
  let t = init(safe, { players: ["p1", "p2"], seed: "x" });
  const go = (action: string, player: string) => {
    const input = legalInputs(safe, t, player).find((i) => i.action === action);
    t = applyOrThrow(safe, t, input!);
  };
  go("strike", "p1");
  expect(view(safe, t, "p1").waiting[0]!.label).toBe("Respond to the attack");
  go("takeIt", "p2");
  go("strike", "p2");
  expect(view(safe, t, "p2").waiting).toEqual([
    { label: "Respond to the attack", actors: ["p1"] },
  ]);
  // p1 can't counter without the card
  expect(legalInputs(safe, t, "p1").map((i) => i.action)).toEqual(["takeIt"]);
});
