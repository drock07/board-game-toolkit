// Every error the engine throws, and every define-time check. All are
// `GameDefinitionError`s except a host's wrong player count (a RangeError);
// an illegal input is never thrown.
import { assert, test } from "vitest";
import {
  AbilityLoopError,
  defaultNodes,
  define,
  entity,
  FlowEndedWithoutEndError,
  FlowStuckError,
  type Game,
  GameDefinitionError,
  init,
  RulesError,
  UnhandledOutcomeError,
  zone,
} from "../index.js";

interface Vars {
  n: number;
}
const card = entity<{ rank: number }>("card");
const deck = zone("deck", { holds: card });
const hand = zone("hand", { holds: card, perPlayer: true });
const core = () =>
  define<Vars>({ zones: [deck, hand] }).withNodes(defaultNodes);
const setup = (tx: { vars: Vars }) => void (tx.vars = { n: 0 });
const start = <V, H>(game: Game<V, H>) =>
  init(game, { players: ["ann", "bob"], seed: "x" });

/** Asserts `fn` throws an instance of `cls` whose message matches `re`, and returns it. */
function throwsA<E extends Error>(
  fn: () => unknown,
  cls: abstract new (...args: never[]) => E,
  re: RegExp,
): E {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof cls, `expected a ${cls.name}, got ${String(e)}`);
    assert.instanceOf(e, GameDefinitionError);
    assert.match((e as Error).message, re);
    return e;
  }
  assert.fail(`expected a ${cls.name}`);
}

// --- Define time -------------------------------------------------------------

test("two zones with one name", () => {
  throwsA(
    () => define({ zones: [deck, zone("deck", { holds: card })] }),
    GameDefinitionError,
    /Two zones are named "deck"/,
  );
});

test("two different entity types with one name", () => {
  const other = entity<{ rank: number }>("card");
  throwsA(
    () => define({ zones: [deck, zone("pile", { holds: other })] }),
    GameDefinitionError,
    /Two different entity types are named "card"/,
  );
});

test("a player count that isn't a positive whole number or an ordered range", () => {
  const { rules, step } = core();
  for (const players of [0, 1.5, [3, 2]] as const)
    throwsA(
      () =>
        rules({
          players: players as number,
          setup,
          flow: step((tx) => tx.end()),
        }),
      GameDefinitionError,
      /players must be/,
    );
});

test("an ability carried in a zone the game doesn't have, or by a type the zone doesn't hold", () => {
  const { rules, ability, step } = core();
  const elsewhere = zone("elsewhere", { holds: card });
  throwsA(
    () =>
      rules({
        players: 2,
        setup,
        abilities: [
          ability({
            of: card,
            in: elsewhere,
            on: "enters",
            then: () => step(() => {}),
          }),
        ],
        flow: step((tx) => tx.end()),
      }),
    GameDefinitionError,
    /zone "elsewhere", which isn't one of this game's zones/,
  );
  const token = entity<{ rank: number }>("token");
  throwsA(
    () =>
      rules({
        players: 2,
        setup,
        abilities: [
          ability({
            of: token,
            in: deck,
            on: "enters",
            then: () => step(() => {}),
          }),
        ],
        flow: step((tx) => tx.end()),
      }),
    GameDefinitionError,
    /carried by "token", but zone "deck" holds "card"/,
  );
});

test("two different actions with one name", () => {
  const { rules, action, prompt, seq } = core();
  const a = action("go", { execute: () => {} });
  const b = action("go", { execute: () => {} });
  throwsA(
    () => rules({ players: 2, setup, flow: seq(prompt(a), prompt(b)) }),
    GameDefinitionError,
    /Two different actions are named "go"/,
  );
});

// --- Run time ------------------------------------------------------------------

test("rules code moving more entities than a zone has", () => {
  const { rules, step } = core();
  const game = rules({
    players: 2,
    setup,
    flow: step((tx) => void tx.moveTop(deck, hand.of("ann"), 2)),
  });
  throwsA(() => start(game), RulesError, /"deck" has 0 entities, not 2/);
});

test("an unknown entity", () => {
  const { rules, step } = core();
  const game = rules({
    players: 2,
    setup,
    flow: step((tx) => void tx.entity("card#9")),
  });
  throwsA(() => start(game), RulesError, /Unknown entity "card#9"/);
});

test("turns starting with a player who isn't playing", () => {
  const { rules, turns, step } = core();
  const game = rules({
    players: 2,
    setup,
    flow: turns(
      { from: () => "zed" },
      step((tx) => tx.end()),
    ),
  });
  throwsA(() => start(game), RulesError, /starts with unknown player "zed"/);
});

test("an outcome nobody handles", () => {
  const { rules, step } = core();
  const game = rules({
    players: 2,
    setup,
    flow: step(() => ({ exit: "won" })),
  });
  throwsA(() => start(game), UnhandledOutcomeError, /Outcome "won"/);
});

test("a flow that ends without ending the game", () => {
  const { rules, step } = core();
  const game = rules({ players: 2, setup, flow: step(() => {}) });
  throwsA(() => start(game), FlowEndedWithoutEndError, /call tx\.end\(\)/);
});

test("a flow that never waits says where it was going round", () => {
  const { rules, loop, step } = core();
  const game = rules({
    players: 2,
    setup,
    flow: loop(
      {},
      step(() => {}),
    ),
  });
  const e = throwsA(
    () => start(game),
    FlowStuckError,
    /without waiting for input/,
  );
  assert.deepEqual([...new Set(e.trace)], ["loop", "step"]);
});

test("an ability that triggers itself names the chain", () => {
  const { rules, effect, ability, step } = core();
  const ping = effect<void>("ping");
  const echo = ability({
    on: ping,
    then: () => step((tx) => tx.cause(ping, undefined)),
  });
  const game = rules({
    players: 2,
    setup,
    abilities: [echo],
    flow: step((tx) => tx.cause(ping, undefined)),
  });
  const e = throwsA(() => start(game), AbilityLoopError, /triggering itself/);
  assert.ok(e.trace.length > 30);
  assert.deepEqual([...new Set(e.trace)], ["effect.ping", "ability.ping"]);
});

test("a host's wrong player count is a RangeError, not a definition bug", () => {
  const { rules, step } = core();
  const game = rules({ players: 2, setup, flow: step((tx) => tx.end()) });
  assert.throws(
    () => init(game, { players: ["ann"], seed: "x" }),
    RangeError,
    /takes 2 to 2 players, not 1/,
  );
});
