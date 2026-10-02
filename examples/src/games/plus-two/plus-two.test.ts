import {
  apply,
  init,
  legalInputs,
  randomBot,
  replay,
  type ApplyResult,
  type Input,
  type Tx,
} from "@drock07/board-game-toolkit-engine";
import {
  hashState,
  playBots,
  transact,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { plusTwo } from ".";
import { hand, type Card, type Types } from "./impl";

type Result = ApplyResult<Types>;
const players = ["p1", "p2", "p3"];

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const prompt = (r: Result, node: string) =>
  r.prompts.find((p) => p.node === node)!;
const act = (
  r: Result,
  node: string,
  player: string,
  action: string,
  card?: string,
): Input => ({
  prompt: prompt(r, node).id,
  player,
  action,
  ...(card ? { args: { card } } : {}),
});

/** The first card matching `want`, anywhere. */
const find = (r: { state: Result["state"] }, want: Partial<Card>) =>
  Object.values(r.state.entities).find((e) =>
    Object.entries(want).every(([k, v]) => e.props[k as keyof Card] === v),
  )!.id;

/**
 * A dealt game where p1 holds red +2s, p2 a blue +2, and the discard's top
 * is red, so p1 can play a +2 at once.
 */
function setUp(): Result {
  const r = init(plusTwo, { players, seed: "s" });
  const state = transact(r.state, (tx: Tx<Types>) => {
    const twos = Object.values(tx.state.entities).filter(
      (e) => e.props.value === "+2",
    );
    const red = twos.filter((e) => e.props.color === "red").map((e) => e.id);
    const blue = twos.find((e) => e.props.color === "blue")!.id;
    const otherTwos = twos
      .filter((e) => e.props.color !== "red" && e.id !== blue)
      .map((e) => e.id);
    tx.move(red, "hand:p1");
    tx.move(blue, "hand:p2");
    // No one else holds a +2, and the top card is a red 3
    tx.move(otherTwos, "deck", { at: "bottom" });
    for (const p of ["p2", "p3"]) {
      const extra = hand(tx, p)
        .filter((e) => e.props.value === "+2" && e.id !== blue)
        .map((e) => e.id);
      tx.move(extra, "deck", { at: "bottom" });
    }
    const red3 = Object.values(tx.state.entities).find(
      (e) =>
        e.props.color === "red" &&
        e.props.value === "3" &&
        e.zone !== "hand:p1",
    )!.id;
    tx.move(red3, "discard");
  }).state;
  return { ...r, state };
}

describe("plus two", () => {
  test("playing a +2 opens a window: others may stack, the victim may take it", () => {
    let r = setUp();
    r = ok(
      apply(
        plusTwo,
        r.state,
        act(
          r,
          "turn",
          "p1",
          "playCard",
          find(r, { color: "red", value: "+2" }),
        ),
      ),
    );
    expect(r.state.vars).toMatchObject({ penalty: 2, victim: "p2" });
    expect(r.prompts.map((p) => [p.node, p.actors])).toEqual([
      ["stack", ["p2", "p3"]],
      ["takePenalty", ["p2"]],
    ]);
    // p3 has no +2, so only p2 can stack
    expect(legalInputs(plusTwo, r.state, "p3")).toEqual([]);
    expect(
      legalInputs(plusTwo, r.state, "p2")
        .map((i) => "action" in i && i.action)
        .sort(),
    ).toEqual(["accept", "stackPlusTwo"]);
  });

  test("taking the penalty draws it, closes the window, and play moves on", () => {
    let r = setUp();
    r = ok(
      apply(
        plusTwo,
        r.state,
        act(
          r,
          "turn",
          "p1",
          "playCard",
          find(r, { color: "red", value: "+2" }),
        ),
      ),
    );
    const before = hand(r, "p2").length;
    r = ok(apply(plusTwo, r.state, act(r, "takePenalty", "p2", "accept")));
    expect(hand(r, "p2")).toHaveLength(before + 2);
    expect(r.state.vars).toMatchObject({ penalty: 0, victim: null });
    expect(r.prompts.map((p) => [p.node, p.actors])).toEqual([
      ["turn", ["p2"]],
    ]);
    expect(Object.keys(r.state.flow.fibers)).toEqual(["f0"]);
  });

  test("stacking passes a bigger penalty on, inside a nested window", () => {
    let r = setUp();
    r = ok(
      apply(
        plusTwo,
        r.state,
        act(
          r,
          "turn",
          "p1",
          "playCard",
          find(r, { color: "red", value: "+2" }),
        ),
      ),
    );
    const outerAccept = prompt(r, "takePenalty");
    r = ok(
      apply(
        plusTwo,
        r.state,
        act(
          r,
          "stack",
          "p2",
          "stackPlusTwo",
          find(r, { color: "blue", value: "+2" }),
        ),
      ),
    );
    expect(r.state.vars).toMatchObject({ penalty: 4, victim: "p3" });
    // The outer window's victim can no longer take it
    expect(
      apply(plusTwo, r.state, {
        prompt: outerAccept.id,
        player: "p2",
        action: "accept",
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "validation_failed", message: "The penalty has moved on" },
    });
    // The nested window: p1 (holding another red +2) or p3 may stack; p3 may take it
    const nested = r.prompts.filter((p) => p.id !== outerAccept.id);
    expect(nested.map((p) => [p.node, p.actors])).toEqual([
      ["stack", ["p1", "p3"]],
      ["takePenalty", ["p3"]],
    ]);
    const before = hand(r, "p3").length;
    r = ok(
      apply(plusTwo, r.state, {
        prompt: nested[1]!.id,
        player: "p3",
        action: "accept",
      }),
    );
    expect(hand(r, "p3")).toHaveLength(before + 4);
    // Both windows close; p1's turn ends and p2 plays next
    expect(r.prompts.map((p) => [p.node, p.actors])).toEqual([
      ["turn", ["p2"]],
    ]);
    expect(Object.keys(r.state.flow.fibers)).toEqual(["f0"]);
  });
});

test("golden replay", async () => {
  const { results, inputs } = playBots(plusTwo, {
    players,
    seed: "golden",
    bots: randomBot(),
    maxInputs: 150,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  expect(hashState(replay(plusTwo, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
