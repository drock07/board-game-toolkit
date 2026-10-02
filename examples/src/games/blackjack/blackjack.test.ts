import {
  apply,
  init,
  replay,
  type ApplyResult,
  type Input,
  type Prompt,
} from "@drock07/board-game-toolkit-engine";
import { hashState, record } from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { blackjack } from ".";
import { handTotal, type Types } from "./impl";

type Result = ApplyResult<Types>;

function ok(res: ReturnType<typeof apply<Types>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

const prompt = (r: Result): Prompt => r.prompts[0]!;
const input = (r: Result, rest: Partial<Input>): Input =>
  ({ prompt: prompt(r).id, player: "p1", ...rest }) as Input;
const cards = (r: Result, zone: "player" | "dealer") =>
  r.state.zones[zone].items.map((id) => r.state.entities[id]!.props);

function start(seed: string) {
  return init(blackjack, { players: ["p1"], seed });
}

function bet(r: Result, amount: number) {
  return ok(
    apply(
      blackjack,
      r.state,
      input(r, { action: "placeBet", args: { amount } }),
    ),
  );
}

/** The first seed (from a fixed list) whose first hand matches `pred` after betting. */
function findSeed(pred: (r: Result) => boolean, amount = 10): string {
  for (let i = 0; i < 2000; i++) {
    const seed = `bj-${i}`;
    if (pred(bet(start(seed), amount))) return seed;
  }
  throw new Error("No seed found");
}

describe("blackjack", () => {
  test("starts by asking p1 to bet", () => {
    const r = start("a");
    expect(r.state.vars).toEqual({ bankroll: 100, bet: 0, result: null });
    expect(r.prompts).toMatchObject([
      { node: "bet", actors: ["p1"], actions: [{ name: "placeBet" }] },
    ]);
    expect(r.state.zones.shoe.items).toHaveLength(52);
  });

  test("rejects bets outside the bankroll", () => {
    const r = start("a");
    for (const amount of [0, 101, 2.5]) {
      expect(
        apply(
          blackjack,
          r.state,
          input(r, { action: "placeBet", args: { amount } }),
        ),
      ).toMatchObject({
        ok: false,
        error: {
          code: "validation_failed",
          message: "Bet a whole amount from 1 to 100",
        },
      });
    }
  });

  test("deals two cards each, with the dealer's second face down", () => {
    const r = bet(start("a"), 10);
    expect(r.state.vars.bankroll).toBe(90);
    expect(cards(r, "player")).toHaveLength(2);
    const dealer = r.state.zones.dealer.items.map(
      (id) => r.state.entities[id]!,
    );
    expect(dealer.map((e) => e.faceUp)).toEqual([undefined, false]);
  });

  test("a natural ends play before any input (guard on entry)", () => {
    const seed = findSeed(
      (r) =>
        r.state.vars.result !== null &&
        cards(r, "player").length === 2 &&
        handTotal(cards(r, "player")) === 21,
    );
    const r = bet(start(seed), 10);
    expect(prompt(r).node).toBe("next");
    expect(["blackjack", "push"]).toContain(r.state.vars.result);
    expect(
      r.events.some((e) => e.type === "flow" && e.node === "playerTurn"),
    ).toBe(false);
    // The hole card is revealed at settle
    expect(
      r.state.zones.dealer.items.every(
        (id) => r.state.entities[id]!.faceUp !== false,
      ),
    ).toBe(true);
  });

  test("hitting to 21 ends the turn (endWhen); busting skips the dealer (guard)", () => {
    let busted = false;
    for (let i = 0; i < 200 && !busted; i++) {
      let r = bet(start(`hit-${i}`), 10);
      while (prompt(r).node === "playerTurn") {
        r = ok(apply(blackjack, r.state, input(r, { action: "hit" })));
      }
      const total = handTotal(cards(r, "player"));
      expect(prompt(r).node).toBe("next");
      if (total > 21) {
        busted = true;
        expect(r.state.vars.result).toBe("lose");
        expect(cards(r, "dealer")).toHaveLength(2); // the dealer never drew
        expect(
          r.events.some(
            (e) =>
              e.type === "flow" &&
              e.kind === "exit" &&
              e.node === "play" &&
              e.outcome === "bust",
          ),
        ).toBe(true);
      } else {
        expect(total).toBe(21);
      }
    }
    expect(busted).toBe(true);
  });

  test("standing lets the dealer draw to 17 and settles the bet", () => {
    let r = bet(start("stand"), 10);
    if (prompt(r).node === "playerTurn")
      r = ok(apply(blackjack, r.state, input(r, { action: "stand" })));
    expect(handTotal(cards(r, "dealer"))).toBeGreaterThanOrEqual(17);
    const payout = { win: 20, push: 10, blackjack: 25, lose: 0 }[
      r.state.vars.result!
    ];
    expect(r.state.vars.bankroll).toBe(90 + payout);
  });

  test("going broke resets the bankroll and offers a new game", () => {
    const seed = findSeed((r) => {
      let x = r;
      if (prompt(x).node === "playerTurn")
        x = ok(apply(blackjack, x.state, input(x, { action: "stand" })));
      return x.state.vars.result === "lose";
    }, 100);
    let r = bet(start(seed), 100);
    if (prompt(r).node === "playerTurn")
      r = ok(apply(blackjack, r.state, input(r, { action: "stand" })));
    expect(prompt(r)).toMatchObject({
      node: "over",
      kind: "pause",
      label: "Play again",
    });
    expect(r.state.vars.bankroll).toBe(1000);
    r = ok(apply(blackjack, r.state, input(r, { continue: true })));
    expect(prompt(r).node).toBe("bet");
    expect(r.state.zones.shoe.items).toHaveLength(52);
  });
});

/** A simple strategy: bet 10, hit below 17, then deal again. */
function strategy(r: Result): Input | undefined {
  const p = prompt(r);
  if (p.node === "bet")
    return input(r, {
      action: "placeBet",
      args: { amount: Math.min(10, r.state.vars.bankroll) },
    });
  if (p.node === "playerTurn") {
    return input(r, {
      action: handTotal(cards(r, "player")) < 17 ? "hit" : "stand",
    });
  }
  return input(r, { continue: true });
}

test("golden replay", async () => {
  const { golden, results } = record(
    blackjack,
    { players: ["p1"], seed: "golden", maxInputs: 120 },
    strategy,
  );
  expect(hashState(replay(blackjack, golden))).toBe(golden.finalStateHash);
  expect(results.at(-1)!.state).toEqual(replay(blackjack, golden));
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
