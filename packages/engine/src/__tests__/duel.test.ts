// Rung 9c: the duel's cases (../duel-rules.md), on effects and abilities.
import { assert, test } from "vitest";
import type { EntityId, State, ZoneId } from "../index.js";
import {
  actors,
  apply,
  defaultNodes,
  define,
  entity,
  init,
  legalInputs,
  zone,
  type Game,
  type Reader,
} from "../index.js";
import { applyOrThrow, fuzz } from "../testing/index.js";
import {
  attack,
  bomb,
  core,
  damage,
  deck,
  discard,
  duel,
  flow,
  hand,
  play,
  setup,
  thorns,
  type CardName,
  type Vars,
} from "./duel.js";

const playCard = duel.action("play");
const pass = duel.action("pass");
const block = duel.action("block");
const allow = duel.action("allow");
const explode = duel.action("explode");
const defuse = duel.action("defuse");

const inInterrupt = (s: State<Vars>) =>
  [s.flow, ...Object.values(s.fibers).map((f) => f.stack)].some((stack) =>
    stack.some((f) => /^(ability|effect)/.test(f.id)),
  );

/** A game after the deal, with nothing reacting: p1 to play. */
function fresh(
  players = ["p1", "p2"],
  game: Game<Vars, unknown> = duel,
): State<Vars> {
  for (let i = 0; ; i++) {
    const s = init(game, { players, seed: `fresh-${i}` });
    if (!inInterrupt(s) && s.pending.length === 0) return s;
  }
}

/** Moves entities to the top of a zone by editing the JSON state (fires nothing). */
function arrange(s: State<Vars>, moves: [EntityId[], ZoneId][]): State<Vars> {
  const out = { ...s, entities: { ...s.entities }, zones: { ...s.zones } };
  for (const [ids, to] of moves) {
    for (const id of ids) {
      const from = out.entities[id]!.zone;
      out.zones[from] = out.zones[from]!.filter((x) => x !== id);
      out.entities[id] = { ...out.entities[id]!, zone: to };
    }
    out.zones[to] = [...ids, ...out.zones[to]!];
  }
  return out;
}

const nameOf = (s: State<Vars>, id: EntityId) =>
  (s.entities[id]!.props as { name: string }).name;
const handOf = (s: State<Vars>, p: string) => s.zones[hand.of(p).id]!;
const withHp = (s: State<Vars>, hp: Record<string, number>) => ({
  ...s,
  vars: { ...s.vars, hp: { ...s.vars.hp, ...hp } },
});

/** Cards by name, each a different entity, in the order asked. */
function pick(s: State<Vars>, names: CardName[]): EntityId[] {
  const used: EntityId[] = [];
  for (const name of names)
    used.push(
      Object.keys(s.entities).find(
        (id) => nameOf(s, id) === name && !used.includes(id),
      )!,
    );
  return used;
}

/**
 * Hands and play zones by card name; every other card goes to the deck,
 * Bombs at the bottom so no draw finds one.
 */
function deal(
  s: State<Vars>,
  layout: {
    hands?: Record<string, CardName[]>;
    play?: Record<string, CardName[]>;
  },
): State<Vars> {
  const hands = Object.entries(layout.hands ?? {});
  const plays = Object.entries(layout.play ?? {});
  const ids = pick(
    s,
    [...hands, ...plays].flatMap(([, n]) => n),
  );
  let at = 0;
  const take = (n: number) => ids.slice(at, (at += n));
  const moves: [EntityId[], ZoneId][] = [];
  for (const [p, names] of hands)
    moves.push([take(names.length), hand.of(p).id]);
  for (const [p, names] of plays)
    moves.push([take(names.length), play.of(p).id]);
  const rest = Object.keys(s.entities).filter((id) => !ids.includes(id));
  s = arrange(s, [[rest, deck.id], ...moves]);
  const bombs = s.zones[deck.id]!.filter((id) => nameOf(s, id) === "Bomb");
  return {
    ...s,
    zones: {
      ...s.zones,
      [deck.id]: [
        ...s.zones[deck.id]!.filter((id) => !bombs.includes(id)),
        ...bombs,
      ],
    },
  };
}

const strike = (s: State<Vars>, by = "p1", target = "p2") =>
  playCard.by(by, {
    card: handOf(s, by).find((id) => nameOf(s, id) === "Strike")!,
    target,
  });

test("1. a Shield holder is asked before the Attack lands: blocking prevents it, allowing lets it through", () => {
  for (const choice of [block, allow]) {
    let s = deal(fresh(), { hands: { p1: ["Strike"], p2: ["Shield"] } });
    s = applyOrThrow(duel, s, strike(s));
    assert.deepEqual(actors(duel, s), ["p2"]);
    assert.deepEqual(
      legalInputs(duel, s)
        .map((i) => i.action)
        .sort(),
      ["allow", "block"],
    );
    assert.strictEqual(s.vars.hp.p2, 10, "nothing has landed yet");
    s = applyOrThrow(duel, s, choice.by("p2"));
    assert.strictEqual(s.vars.hp.p2, choice === block ? 10 : 8);
    assert.strictEqual(
      s.zones[discard.id]!.some((id) => nameOf(s, id) === "Shield"),
      choice === block,
    );
    assert.ok(!inInterrupt(s));
  }
});

test("1b. two Shields: once one blocks, the other isn't asked", () => {
  let s = deal(fresh(), {
    hands: { p1: ["Strike"], p2: ["Shield", "Shield"] },
  });
  s = applyOrThrow(duel, s, strike(s));
  s = applyOrThrow(duel, s, block.by("p2"));
  assert.ok(!inInterrupt(s));
  assert.strictEqual(s.vars.hp.p2, 10);
});

test("1c. without a Shield the Attack resolves within the same input", () => {
  let s = deal(fresh(), { hands: { p1: ["Strike"] } });
  s = applyOrThrow(duel, s, strike(s));
  assert.strictEqual(s.vars.hp.p2, 8);
  assert.deepEqual(actors(duel, s), ["p2"], "p2's turn, not a reaction");
});

test("2. Thorns costs the attacker 1; Thorns damage isn't an Attack, so the attacker's Thorns stays quiet", () => {
  const s = deal(fresh(), {
    hands: { p1: ["Strike"] },
    play: { p1: ["Thorns"], p2: ["Thorns"] },
  });
  const out = apply(duel, s, strike(s));
  assert.ok(out.ok);
  assert.deepEqual([out.state.vars.hp.p1, out.state.vars.hp.p2], [9, 8]);
  const damages = out.events.flatMap((e) =>
    e.type === "effect" && e.name === "damage" ? [e.data] : [],
  );
  assert.deepEqual(damages, [
    { to: "p2", amount: 2, attack: { by: "p1" } },
    { to: "p1", amount: 1 },
  ]);
});

test("3. Shield and Thorns on one Attack: Shield first; a blocked Attack never reaches Thorns", () => {
  let s = deal(fresh(), {
    hands: { p1: ["Strike"], p2: ["Shield"] },
    play: { p2: ["Thorns"] },
  });
  s = applyOrThrow(duel, s, strike(s));
  assert.deepEqual(actors(duel, s), ["p2"], "asked before anything is damaged");
  const blocked = applyOrThrow(duel, s, block.by("p2"));
  assert.deepEqual([blocked.vars.hp.p1, blocked.vars.hp.p2], [10, 10]);
  const allowed = applyOrThrow(duel, s, allow.by("p2"));
  assert.deepEqual([allowed.vars.hp.p1, allowed.vars.hp.p2], [9, 8]);
});

test("4a. Bomb by draw: the drawer answers in the middle of their turn; defusing shuffles it back", () => {
  let s = deal(fresh(), {
    hands: { p1: ["Strike"], p2: ["Strike", "Strike"] },
  });
  const [b] = pick(s, ["Bomb"]);
  s = arrange(s, [[[b!], deck.id]]);
  s = applyOrThrow(duel, s, pass.by("p1"));
  assert.deepEqual(actors(duel, s), ["p2"]);
  assert.deepEqual(
    [...new Set(legalInputs(duel, s).map((i) => i.action))].sort(),
    ["defuse", "explode"],
  );
  const kept = handOf(s, "p2").find((id) => id !== b)!;
  s = applyOrThrow(duel, s, defuse.by("p2", { card: kept }));
  assert.strictEqual(s.entities[b!]!.zone, deck.id);
  assert.strictEqual(s.vars.hp.p2, 10);
  assert.deepEqual(
    [...new Set(legalInputs(duel, s).map((i) => i.action))].sort(),
    ["pass", "play"],
    "then p2 plays their turn",
  );
});

test("4a'. a Bomb drawn into an otherwise empty hand goes off without asking", () => {
  let s = deal(fresh(), { hands: { p1: ["Strike"] } });
  const [b] = pick(s, ["Bomb"]);
  s = arrange(s, [[[b!], deck.id]]);
  s = applyOrThrow(duel, s, pass.by("p1"));
  assert.strictEqual(s.vars.hp.p2, 7);
  assert.strictEqual(s.entities[b!]!.zone, discard.id);
});

/** A seed whose deal gives `bombs` Bombs to the players listed. */
function dealtBombs(want: (p1: number, p2: number) => boolean) {
  for (let i = 0; i < 5000; i++) {
    const s = init(duel, { players: ["p1", "p2"], seed: `deal-${i}` });
    const n = (p: string) =>
      handOf(s, p).filter((id) => nameOf(s, id) === "Bomb").length;
    if (want(n("p1"), n("p2"))) return s;
  }
  throw new Error("no seed deals that");
}

test("4b. Bombs dealt to both players in one transaction resolve in seat order", () => {
  let s = dealtBombs((a, b) => a === 1 && b === 1);
  assert.deepEqual(actors(duel, s), ["p1"]);
  s = applyOrThrow(duel, s, explode.by("p1"));
  assert.deepEqual(actors(duel, s), ["p2"]);
  s = applyOrThrow(duel, s, explode.by("p2"));
  assert.deepEqual([s.vars.hp.p1, s.vars.hp.p2], [7, 7]);
  assert.ok(!inInterrupt(s));
});

test("4b'. a Bomb discarded to defuse another never goes off", () => {
  let s = dealtBombs((a) => a === 2);
  const bombs = handOf(s, "p1").filter((id) => nameOf(s, id) === "Bomb");
  s = applyOrThrow(duel, s, defuse.by("p1", { card: bombs[1]! }));
  assert.ok(!inInterrupt(s));
  assert.strictEqual(s.vars.hp.p1, 10);
  assert.strictEqual(s.entities[bombs[1]!]!.zone, discard.id);
});

test("4c. a stolen Bomb is answered by the thief, inside the thief's action", () => {
  let s = deal(fresh(), { hands: { p1: ["Steal", "Strike"], p2: ["Bomb"] } });
  const [steal] = handOf(s, "p1").filter((id) => nameOf(s, id) === "Steal");
  const strikeCard = handOf(s, "p1").find((id) => nameOf(s, id) === "Strike")!;
  s = applyOrThrow(duel, s, playCard.by("p1", { card: steal!, target: "p2" }));
  assert.deepEqual(actors(duel, s), ["p1"]);
  s = applyOrThrow(duel, s, defuse.by("p1", { card: strikeCard }));
  assert.strictEqual(s.vars.hp.p1, 10);
  assert.deepEqual(actors(duel, s), ["p2"], "then p1's turn is over");
});

test("5. an ability that triggers itself ends with a clear error", () => {
  const { rules, ability, step } = core;
  const cursed = ability({
    of: entity<{ name: CardName }>("card"),
    in: play,
    on: damage,
    when: (_s, t) => t.data.to === t.owner,
    then: (t) =>
      step((tx) => tx.cause(damage, { to: t.owner(tx)!, amount: 1 })),
  });
  const game = rules({
    players: [2, 3],
    setup,
    abilities: [cursed],
    flow,
  });
  let s = init(game, { players: ["p1", "p2"], seed: "x" });
  s = deal(s, { hands: { p1: ["Strike"] }, play: { p2: ["Thorns"] } });
  assert.throws(
    () => apply(game, s, game.action("play").by("p1", strike(s).args)),
    /probably triggering itself/,
  );
});

test("6. a Bomb that takes its holder to 0 ends the game cleanly", () => {
  let s = withHp(deal(fresh(), { hands: { p1: ["Strike"] } }), { p2: 3 });
  const [b] = pick(s, ["Bomb"]);
  s = arrange(s, [[[b!], deck.id]]);
  s = applyOrThrow(duel, s, pass.by("p1"));
  assert.strictEqual(s.status, "finished");
  assert.deepEqual(s.result, { winner: "p1" });
});

test("6b. an outcome during a chain: the reactions still resolve, then the outcome's handler", () => {
  // The killing blow fires the guard; Thorns, queued by the same damage, still pricks
  let s = withHp(
    deal(fresh(), { hands: { p1: ["Strike"] }, play: { p2: ["Thorns"] } }),
    {
      p2: 2,
    },
  );
  s = applyOrThrow(duel, s, strike(s));
  assert.strictEqual(s.status, "finished");
  assert.deepEqual(s.result, { winner: "p1" });
  assert.strictEqual(s.vars.hp.p1, 9);
});

test("6c. Thorns killing the attacker ends the game", () => {
  let s = withHp(
    deal(fresh(), { hands: { p1: ["Strike"] }, play: { p2: ["Thorns"] } }),
    {
      p1: 1,
    },
  );
  s = applyOrThrow(duel, s, strike(s));
  assert.strictEqual(s.status, "finished");
  assert.deepEqual(s.result, { winner: "p2" });
});

test("6d. an action that raises an outcome still gets its reactions", () => {
  interface V {
    poked: number;
  }
  const thing = entity<{ n: number }>("thing");
  const board = zone("board", { holds: thing });
  const { rules, action, ability, effect, prompt, step, seq, outcomes } =
    define<V>({
      zones: [board],
    }).withNodes(defaultNodes);
  const ping = effect<null>("ping");
  const game = rules({
    setup: (tx) => {
      tx.vars = { poked: 0 };
      tx.create(thing, { n: 1 }, board);
    },
    abilities: [
      ability({
        of: thing,
        in: board,
        on: ping,
        then: () => step((tx) => void tx.vars.poked++),
      }),
    ],
    flow: seq(
      outcomes(
        { quit: {} },
        prompt(
          action("quit", {
            execute: (tx) => {
              tx.cause(ping, null);
              return { exit: "quit" };
            },
          }),
        ),
      ),
      step((tx) => tx.end()),
    ),
  });
  const s = applyOrThrow(
    game,
    init(game, { players: ["p1"], seed: "x" }),
    game.action("quit").by("p1"),
  );
  assert.strictEqual(s.status, "finished");
  assert.strictEqual(s.vars.poked, 1);
});

test("7. fuzz: random games finish, views never leak, events replay", () => {
  for (const players of [
    ["p1", "p2"],
    ["p1", "p2", "p3"],
  ]) {
    const report = fuzz(duel, { seeds: 60, players, maxInputs: 400 });
    assert.deepEqual(report.failures, []);
    assert.strictEqual(report.finished, 60);
  }
});

test("8. hidden information: a carried Shield leaks through actors(); a game-wide rule that always asks doesn't", () => {
  // As carried, the game waits on the target only when they hold a Shield
  let s = deal(fresh(), { hands: { p1: ["Strike"] } });
  assert.strictEqual(applyOrThrow(duel, s, strike(s)).vars.hp.p2, 8);
  s = deal(fresh(), { hands: { p1: ["Strike"], p2: ["Shield"] } });
  assert.deepEqual(actors(duel, applyOrThrow(duel, s, strike(s))), ["p2"]);

  // As a rule: the target is always asked; blocking needs a Shield
  const { rules, action, ability, prompt } = core;
  const shields = (s: Pick<Reader<Vars>, "entities">, p: string) =>
    s.entities(hand.of(p)).filter((e) => e.props.name === "Shield");
  const guard = ability({
    on: attack.before,
    who: (_s, a) => a.target,
    then: (t) =>
      prompt(
        action("guard", {
          validate: (s, actor) =>
            shields(s, actor).length ? true : "You hold no Shield",
          execute: (tx, actor) => {
            tx.move(shields(tx, actor)[0]!.id, discard);
            t.data(tx).prevented = true;
          },
        }),
        action("take", { execute: () => {} }),
      ),
  });
  const ruled = rules({
    players: [2, 3],
    setup,
    abilities: [guard, thorns, bomb],
    flow,
  });
  for (const holds of [[], ["Shield"]] as CardName[][]) {
    let r = deal(fresh(["p1", "p2"], ruled), {
      hands: { p1: ["Strike"], p2: holds },
    });
    r = applyOrThrow(ruled, r, ruled.action("play").by("p1", strike(r).args));
    assert.deepEqual(actors(ruled, r), ["p2"], "asked either way");
    assert.deepEqual(
      legalInputs(ruled, r)
        .map((i) => i.action)
        .sort(),
      holds.length ? ["guard", "take"] : ["take"],
    );
  }
});

test("9. a player who is out is skipped; an empty deck ends the game on HP", () => {
  let s = withHp(deal(fresh(["p1", "p2", "p3"]), {}), { p2: 0, p3: 4 });
  s = applyOrThrow(duel, s, pass.by("p1"));
  assert.deepEqual(actors(duel, s), ["p3"], "p2 is skipped");
  s = arrange(s, [[s.zones[deck.id]!, discard.id]]);
  s = applyOrThrow(duel, s, pass.by("p3"));
  assert.strictEqual(s.status, "finished");
  assert.deepEqual(s.result, { winner: "p1" });
});

test("types: effects and abilities infer from one declaration each", () => {
  const { ability, step } = core;
  ability({
    of: entity<{ name: CardName }>("card"),
    in: hand,
    on: attack.before,
    // @ts-expect-error an Attack has no `amount`
    when: (_s, t) => t.data.amount > 0,
    then: (t) =>
      step((tx) => {
        t.data(tx).prevented = true;
        // @ts-expect-error a card has no hp
        void t.self(tx).props.hp;
      }),
  });
  const e = define<Vars>().effect("e", {
    resolve: (_tx, d: { n: number }) => void d.n,
  });
  step((tx) => {
    // @ts-expect-error `n` is a number
    tx.cause(e, { n: "1" });
  });
  // Timing is part of `on`: only an effect has a `.before`. (Overloads
  // report the excess property at the call.)
  // @ts-expect-error -- there is no `timing`; write `on: effect.before`
  ability({
    of: entity("card"),
    in: hand,
    on: "enters",
    timing: "before",
    then: () => step(() => {}),
  });
});
