// The card effects guide's claims, played on the duel.
import {
  actors,
  init,
  legalInputs,
  view,
  type Ability,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow, fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import {
  bomb,
  card,
  carriedShield,
  core,
  deck,
  discard,
  duel,
  flow,
  play,
  playCard,
  shield,
  thorns,
  type CardName,
  type Vars,
} from "./cardEffects";

/** The duel with a deck in a known order, top first, and the given abilities. */
function stacked<const As extends readonly Ability<Vars, unknown>[]>(
  order: CardName[],
  abilities: As,
) {
  return core.rules({
    players: [2, 3],
    setup: (tx) => {
      tx.vars = { hp: Object.fromEntries(tx.players.map((p) => [p, 10])) };
      for (const name of [...order, ...Array<CardName>(20).fill("Strike")])
        tx.create(card, { name }, deck);
    },
    abilities,
    flow,
  });
}

const rules = [shield, thorns, bomb] as const;

test("a Bomb dealt into a hand goes off, in the middle of the deal", () => {
  const g = stacked(["Bomb"], rules);
  const s = init(g, { players: ["p1", "p2"], seed: "x" });
  expect(s.vars.hp).toEqual({ p1: 7, p2: 10 });
  expect(s.entities[s.zones[discard.id]![0]!]!.props).toEqual({
    name: "Bomb",
  });
});

test("Shield as a rule: the target is asked either way; blocking needs a Shield", () => {
  for (const holds of [false, true]) {
    const g = stacked(
      ["Strike", "Strike", "Strike", holds ? "Shield" : "Strike"],
      rules,
    );
    let s = init(g, { players: ["p1", "p2"], seed: "x" });
    const strike = legalInputs(g, s, "p1").find((i) => i.action === "play")!;
    s = applyOrThrow(g, s, strike);
    expect(actors(g, s)).toEqual(["p2"]);
    expect(view(g, s, "p1").waiting).toEqual([
      { label: "Block with a Shield?", actors: ["p2"] },
    ]);
    expect(
      legalInputs(g, s)
        .map((i) => i.action)
        .sort(),
    ).toEqual(holds ? ["block", "take"] : ["take"]);
    if (holds) {
      s = applyOrThrow(g, s, g.action("block").by("p2"));
      expect(s.vars.hp.p2).toBe(10);
    }
  }
});

test("a carried Shield in a hidden hand leaks through who the game waits on", () => {
  const ask = (holds: boolean) => {
    const g = stacked(
      [
        "Strike",
        "Strike",
        "Strike",
        "Strike",
        "Strike",
        "Strike",
        holds ? "Shield" : "Strike",
      ],
      [carriedShield, thorns, bomb],
    );
    let s = init(g, { players: ["p1", "p2", "p3"], seed: "x" });
    const strike = legalInputs(g, s, "p1").find(
      (i) => playCard.is(i) && i.args.target === "p3",
    )!;
    s = applyOrThrow(g, s, strike);
    return actors(g, s);
  };
  // p3 is asked only when they hold a Shield; otherwise p2's turn starts
  expect(ask(true)).toEqual(["p3"]);
  expect(ask(false)).toEqual(["p2"]);
});

test("Thorns: damage causes damage back, nested inside the Attack", () => {
  const g = stacked(["Strike", "Strike", "Strike", "Thorns"], rules);
  let s = init(g, { players: ["p1", "p2"], seed: "x" });
  s = applyOrThrow(g, s, g.action("pass").by("p1"));
  const thornsCard = legalInputs(g, s, "p2").find(
    (i) => playCard.is(i) && !i.args.target,
  )!;
  s = applyOrThrow(g, s, thornsCard);
  expect(s.zones[play.of("p2").id]).toHaveLength(1);
  const strike = legalInputs(g, s, "p1").find((i) => i.action === "play")!;
  s = applyOrThrow(g, s, strike);
  s = applyOrThrow(g, s, g.action("take").by("p2"));
  expect(s.vars.hp).toEqual({ p1: 9, p2: 8 });
});

test("fuzz: duels finish, views never leak, events replay", () => {
  for (const players of [
    ["p1", "p2"],
    ["p1", "p2", "p3"],
  ]) {
    const report = fuzz(duel, { seeds: 40, players, maxInputs: 300 });
    expect(report.failures).toEqual([]);
    expect(report.finished).toBe(40);
  }
});
