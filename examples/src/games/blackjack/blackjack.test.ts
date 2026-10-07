import {
  apply,
  init,
  legalInputs,
  replayInputs,
  view,
  type GameInput,
  type State,
} from "@drock07/board-game-toolkit-engine";
import {
  applyOrThrow,
  hashState,
  playBots,
  type SyncBot,
} from "@drock07/board-game-toolkit-engine/testing";
import { describe, expect, test } from "vitest";
import { blackjack, hit, next, placeBet, stand } from ".";
import type { PlayingCard } from "../shared/cards";
import { dealer, handTotal, player, shoe, type Vars } from "./game";

type S = State<Vars>;

const players = ["p1"];
const start = (seed: string) => init(blackjack, { players, seed });
/** What the game waits on, by its prompt's label. */
const waiting = (s: S) => view(blackjack, s, "p1").waiting[0]?.label;
/** A hand's cards in deal order (zones list the top first). */
const cards = (s: S, zone: typeof player) =>
  s.zones[zone.id]!.map((id) => s.entities[id]!.props as PlayingCard);
const bet = (s: S, amount: number) =>
  applyOrThrow(blackjack, s, placeBet.by("p1", { amount }));

/** The first seed (from a fixed list) whose first hand matches `pred` after betting. */
function findSeed(pred: (s: S) => boolean, amount = 10): string {
  for (let i = 0; i < 2000; i++) {
    const seed = `bj-${i}`;
    if (pred(bet(start(seed), amount))) return seed;
  }
  throw new Error("No seed found");
}

describe("blackjack", () => {
  test("starts by asking p1 to bet", () => {
    const s = start("a");
    expect(s.vars).toEqual({ bankroll: 100, bet: 0, result: null });
    expect(waiting(s)).toBe("Place a bet");
    expect(
      new Set(legalInputs(blackjack, s, "p1").map((i) => i.action)),
    ).toEqual(new Set(["placeBet"]));
    expect(s.zones[shoe.id]).toHaveLength(52);
  });

  test("rejects bets outside the bankroll", () => {
    const s = start("a");
    for (const amount of [0, 101, 2.5]) {
      expect(apply(blackjack, s, placeBet.by("p1", { amount }))).toEqual({
        ok: false,
        reason: "Bet a whole amount from 1 to 100",
      });
    }
  });

  test("deals two cards each, with the dealer's second face down", () => {
    const s = bet(start("a"), 10);
    expect(s.vars.bankroll).toBe(90);
    expect(cards(s, player)).toHaveLength(2);
    const dealt = s.zones[dealer.id]!.map((id) => s.entities[id]!);
    expect(dealt.map((e) => e.faceUp)).toEqual([undefined, false]);
    // The view hides the hole card even though the dealer's zone is public
    const v = view(blackjack, s, "p1");
    const [up, hole] = v.zones[dealer.id]!;
    expect(v.entities[hole!]).toMatchObject({ hidden: true });
    expect(v.entities[up!]).toMatchObject({ type: "card" });
  });

  test("a natural ends play before any input (guard on entry)", () => {
    const seed = findSeed(
      (s) => s.vars.result !== null && cards(s, player).length === 2,
    );
    const s = bet(start(seed), 10);
    expect(handTotal(cards(s, player))).toBe(21);
    expect(waiting(s)).toBe("Deal again");
    expect(["blackjack", "push"]).toContain(s.vars.result);
    // The hole card is revealed at settle
    expect(
      s.zones[dealer.id]!.every((id) => s.entities[id]!.faceUp !== false),
    ).toBe(true);
  });

  test("hitting to 21 ends the turn (until); busting skips the dealer (guard)", () => {
    let busted = false;
    for (let i = 0; i < 200 && !busted; i++) {
      let s = bet(start(`hit-${i}`), 10);
      while (waiting(s) === "Hit or stand")
        s = applyOrThrow(blackjack, s, hit.by("p1"));
      const total = handTotal(cards(s, player));
      expect(waiting(s)).toBe("Deal again");
      if (total > 21) {
        busted = true;
        expect(s.vars.result).toBe("lose");
        expect(cards(s, dealer)).toHaveLength(2); // the dealer never drew
      } else {
        expect(total).toBe(21);
      }
    }
    expect(busted).toBe(true);
  });

  test("standing lets the dealer draw to 17 and settles the bet", () => {
    let s = bet(start("stand"), 10);
    if (waiting(s) === "Hit or stand")
      s = applyOrThrow(blackjack, s, stand.by("p1"));
    expect(handTotal(cards(s, dealer))).toBeGreaterThanOrEqual(17);
    const payout = { win: 20, push: 10, blackjack: 25, lose: 0 }[
      s.vars.result!
    ];
    expect(s.vars.bankroll).toBe(90 + payout);
  });

  test("going broke resets the bankroll and offers a new game", () => {
    const standIfAsked = (s: S) =>
      waiting(s) === "Hit or stand"
        ? applyOrThrow(blackjack, s, stand.by("p1"))
        : s;
    const seed = findSeed((s) => standIfAsked(s).vars.result === "lose", 100);
    let s = standIfAsked(bet(start(seed), 100));
    expect(view(blackjack, s, "p1").waiting).toEqual([
      { label: "Play again", actors: ["p1"] },
    ]);
    expect(s.vars.bankroll).toBe(1000);
    s = applyOrThrow(blackjack, s, next.by("p1"));
    expect(waiting(s)).toBe("Place a bet");
    expect(s.zones[shoe.id]).toHaveLength(52);
  });
});

/** A simple strategy: bet 10, hit below 17, then deal again. */
const strategy: SyncBot<Vars, GameInput<typeof blackjack>> = (
  legal,
  { view: v },
) => {
  const bets = legal.filter(placeBet.is);
  if (bets.length)
    return placeBet.by(v.player, { amount: Math.min(10, v.vars.bankroll) });
  if (legal.some(stand.is)) {
    const mine = v.zones[player.id]!.map(
      (ref) => (v.entities[ref] as { props: PlayingCard }).props,
    );
    return handTotal(mine) < 17 && legal.some(hit.is)
      ? hit.by(v.player)
      : stand.by(v.player);
  }
  return next.by(v.player);
};

test("golden replay", async () => {
  const { states, inputs } = playBots(blackjack, {
    players,
    seed: "golden",
    bots: strategy,
    maxInputs: 120,
  });
  const golden = {
    players,
    seed: "golden",
    inputs,
    finalStateHash: hashState(states.at(-1)!),
  };
  expect(hashState(replayInputs(blackjack, golden, golden.inputs))).toBe(
    golden.finalStateHash,
  );
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
