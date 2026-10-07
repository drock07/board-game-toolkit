import {
  actors,
  apply,
  check,
  init,
  legalInputs,
  randomBot,
  replayInputs,
  view,
  type EntityId,
  type State,
  type ZoneId,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  record,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import {
  accept,
  again,
  drawCard,
  pass,
  playCard,
  plusTwo,
  stackPlusTwo,
} from ".";
import {
  deck,
  discard,
  hand,
  TURN_LABEL,
  WINDOW_LABEL,
  type Card,
  type Vars,
} from "./game";

const players = ["p1", "p2", "p3"];

/** Moves entities to the top of a zone by editing the JSON state. */
function arrange(s: State<Vars>, moves: [EntityId[], ZoneId][]): State<Vars> {
  const out = { ...s, entities: { ...s.entities }, zones: { ...s.zones } };
  for (const [ids, to] of moves) {
    for (const id of ids) {
      const from = out.entities[id]!.zone;
      out.zones[from] = out.zones[from]!.filter((x) => x !== id);
      out.entities[id] = { ...out.entities[id]!, zone: to };
    }
    out.zones[to] = [...ids, ...out.zones[to]!.filter((x) => !ids.includes(x))];
  }
  return out;
}

/** The ids of every card matching `want`, anywhere. */
const cards = (s: State<Vars>, want: Partial<Card>) =>
  Object.values(s.entities)
    .filter((e) =>
      Object.entries(want).every(
        ([k, v]) => (e.props as Card)[k as keyof Card] === v,
      ),
    )
    .map((e) => e.id);
const handOf = (s: State<Vars>, p: string) => s.zones[hand.of(p).id]!;
const waiting = (s: State<Vars>) =>
  view(plusTwo, s, "p1").waiting.map((w) => [w.label, w.actors]);

/**
 * A dealt game where p1 holds the red +2s, p2 one blue +2, p3 none, and the
 * discard's top is a red 3, so p1 can play a +2 at once.
 */
function setUp(): State<Vars> {
  let s = init(plusTwo, { players, seed: "s" });
  const twos = cards(s, { value: "+2" });
  const red = cards(s, { color: "red", value: "+2" });
  const blue = cards(s, { color: "blue", value: "+2" })[0]!;
  s = arrange(s, [
    [twos.filter((id) => !red.includes(id) && id !== blue), deck.id],
    [red, hand.of("p1").id],
    [[blue], hand.of("p2").id],
    [[cards(s, { color: "red", value: "3" })[0]!], discard.id],
  ]);
  return s;
}

/** p1 plays a red +2 on the set-up deal. */
const opened = () => {
  const s = setUp();
  const red = cards(s, { color: "red", value: "+2" })[0]!;
  return applyOrThrow(plusTwo, s, playCard.by("p1", { card: red }));
};

describe("plus two", () => {
  test("deals five each and one to the discard; the first seat starts", () => {
    const s = init(plusTwo, { players, seed: "d" });
    for (const p of players) expect(handOf(s, p)).toHaveLength(5);
    expect(s.zones[discard.id]).toHaveLength(1);
    expect(waiting(s)).toEqual([[TURN_LABEL, ["p1"]]]);
  });

  test("you may draw only with nothing playable, and pass only with nothing to draw", () => {
    const s = setUp();
    expect(apply(plusTwo, s, drawCard.by("p1"))).toEqual({
      ok: false,
      reason: "You have a card you can play",
    });
    expect(apply(plusTwo, s, pass.by("p1"))).toEqual({
      ok: false,
      reason: "You can still play or draw",
    });
  });

  test("playing a +2 opens a window: others may stack, the victim may take it", () => {
    const s = opened();
    expect(s.vars).toMatchObject({ penalty: 2, stacker: "p1", victim: "p2" });
    expect(waiting(s)).toEqual([[WINDOW_LABEL, ["p2", "p3"]]]);
    // p3 has no +2 and isn't the victim, so has nothing to do
    expect(legalInputs(plusTwo, s, "p3")).toEqual([]);
    expect(
      legalInputs(plusTwo, s, "p2")
        .map((i) => i.action)
        .sort(),
    ).toEqual(["accept", "stackPlusTwo"]);
    // The stacker can't answer their own +2
    expect(legalInputs(plusTwo, s, "p1")).toEqual([]);
  });

  test("taking the penalty draws it, closes the window, and play moves on", () => {
    let s = opened();
    const before = handOf(s, "p2").length;
    s = applyOrThrow(plusTwo, s, accept.by("p2"));
    expect(handOf(s, "p2")).toHaveLength(before + 2);
    expect(s.vars).toMatchObject({ penalty: 0, victim: null, stacker: null });
    expect(waiting(s)).toEqual([[TURN_LABEL, ["p2"]]]);
  });

  test("stacking passes a bigger penalty on to the next seat", () => {
    let s = opened();
    const blue = cards(s, { color: "blue", value: "+2" })[0]!;
    s = applyOrThrow(plusTwo, s, stackPlusTwo.by("p2", { card: blue }));
    expect(s.vars).toMatchObject({ penalty: 4, stacker: "p2", victim: "p3" });
    // The old victim can no longer take it
    expect(apply(plusTwo, s, accept.by("p2"))).toMatchObject({ ok: false });
    expect(check(plusTwo, s, accept.by("p3"))).toBe(true);
    // p1 (holding another red +2) or p3 may answer now; only p3 may take it
    expect(waiting(s)).toEqual([[WINDOW_LABEL, ["p1", "p3"]]]);
    expect(legalInputs(plusTwo, s, "p1").map((i) => i.action)).toEqual([
      "stackPlusTwo",
    ]);
    const before = handOf(s, "p3").length;
    s = applyOrThrow(plusTwo, s, accept.by("p3"));
    expect(handOf(s, "p3")).toHaveLength(before + 4);
    // The window closes; p1's turn is over and p2 plays next
    expect(waiting(s)).toEqual([[TURN_LABEL, ["p2"]]]);
  });

  test("an empty hand ends the game; playing again redeals", () => {
    let s = setUp();
    const red3 = cards(s, { color: "red", value: "3" });
    const last = red3.find((id) => !s.zones[discard.id]!.includes(id))!;
    s = arrange(s, [
      [handOf(s, "p1"), deck.id],
      [[last], hand.of("p1").id],
    ]);
    s = applyOrThrow(plusTwo, s, playCard.by("p1", { card: last }));
    expect(s.vars.winner).toBe("p1");
    expect(waiting(s)).toEqual([["Play again", ["p1"]]]);
    s = applyOrThrow(plusTwo, s, again.by("p1"));
    expect(s.vars.winner).toBe(null);
    for (const p of players) expect(handOf(s, p)).toHaveLength(5);
    expect(s.zones[discard.id]).toHaveLength(1);
    expect(actors(plusTwo, s)).toEqual(["p1"]);
  });
});

test("golden replay", async () => {
  // Random play over every actor's inputs. playBots asks only the first
  // actor, who in a window may hold no +2, so it would stop there
  const bot = randomBot("golden");
  const { golden } = record(
    plusTwo,
    { players, seed: "golden", maxInputs: 150 },
    (s) => bot(legalInputs(plusTwo, s)),
  );
  expect(hashState(replayInputs(plusTwo, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
