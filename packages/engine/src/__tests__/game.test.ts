import { assert, test } from "vitest";
import {
  actors,
  check,
  current,
  defaultNodes,
  define,
  init,
  legalInputs,
  view,
} from "../index.js";
import { applyOrThrow, fuzz } from "../testing/index.js";
import {
  bid,
  lots,
  revealed,
  sealed,
  sealedBids,
  STARTING_COINS,
  won,
} from "./game.js";

const players = ["ann", "bob", "cat"];
const place = sealedBids.action("bid");

test("everyone lowers to simultaneous(prompt) and keeps the spec JSON", () => {
  const flow = JSON.stringify(sealedBids.spec.flow);
  assert.ok(
    flow.includes(
      '"kind":"simultaneous","id":"simultaneous","body":{"kind":"prompt"',
    ),
  );
  assert.ok(!flow.includes('"everyone"'));
  assert.ok("simultaneous" in sealedBids.kinds && "prompt" in sealedBids.kinds);
  assert.deepEqual(
    JSON.parse(JSON.stringify(sealedBids.spec)),
    sealedBids.spec,
  );
});

test("everyone may bid, in any order, once each", () => {
  let s = init(sealedBids, { players, seed: "a" });
  assert.deepEqual(actors(sealedBids, s), players);
  assert.strictEqual(current(sealedBids, s), "ann");
  for (const p of players)
    assert.strictEqual(
      legalInputs(sealedBids, s, p).length,
      STARTING_COINS + 1,
    );
  assert.strictEqual(
    legalInputs(sealedBids, s).length,
    3 * (STARTING_COINS + 1),
  );
  assert.strictEqual(
    check(sealedBids, s, place.by("dan", { amount: 1 })),
    "dan has nothing to do right now",
  );
  s = applyOrThrow(sealedBids, s, place.by("bob", { amount: 3 }));
  assert.deepEqual(actors(sealedBids, s), ["ann", "cat"]);
  assert.strictEqual(
    check(sealedBids, s, place.by("bob", { amount: 4 })),
    "bob has nothing to do right now",
  );
  assert.deepEqual(legalInputs(sealedBids, s, "bob"), []);
  // Only bob can see bob's bid
  // Views key entities by ref; a bid keeps its ref until a shuffle
  const bobsBid = s.entities[s.zones[sealed.of("bob").id]![0]!]!.ref;
  assert.ok(bid.is(view(sealedBids, s, "bob").entities[bobsBid]!));
  assert.ok("hidden" in view(sealedBids, s, "ann").entities[bobsBid]!);
  s = applyOrThrow(sealedBids, s, place.by("cat", { amount: 5 }));
  assert.strictEqual(s.flow.at(-1)?.id, "simultaneous", "still waiting on ann");
  s = applyOrThrow(sealedBids, s, place.by("ann", { amount: 5 }));
  // Resolved: ann and cat tied at 5, the earlier seat wins and pays
  assert.deepEqual(s.vars.lastResult?.winner, "ann");
  assert.strictEqual(s.vars.lastResult?.paid, 5);
  assert.strictEqual(s.vars.coins.ann, STARTING_COINS - 5);
  assert.strictEqual(s.zones[won.of("ann").id]!.length, 1);
  assert.strictEqual(s.zones[lots.id]!.length, 2);
  assert.strictEqual(
    s.zones[revealed.id]!.length,
    3,
    "all bids are public now",
  );
  for (const p of players) assert.deepEqual(s.zones[sealed.of(p).id], []);
  assert.ok(
    bid.is(view(sealedBids, s, "ann").entities[bobsBid]!),
    "ann sees bob's revealed bid",
  );
  assert.deepEqual(
    actors(sealedBids, s),
    players,
    "next round, everyone again",
  );
});

test("three rounds, then the richest wins", () => {
  const report = fuzz(sealedBids, { seeds: 30, players, maxInputs: 40 });
  assert.deepEqual(report.failures, []);
  assert.strictEqual(report.finished, 30);
  let s = init(sealedBids, { players, seed: "z" });
  for (let round = 0; round < 3; round++)
    for (const p of players)
      s = applyOrThrow(sealedBids, s, place.by(p, { amount: 0 }));
  assert.strictEqual(s.status, "finished");
  const r = s.result as { winners: string[]; scores: Record<string, number> };
  assert.strictEqual(
    s.zones[won.of("ann").id]!.length,
    3,
    "all ties go to the first seat",
  );
  assert.strictEqual(r.scores.ann, STARTING_COINS + 22);
  assert.deepEqual(r.winners, ["ann"]);
});

test("types", () => {
  const s = init(sealedBids, { players, seed: "t" });
  // @ts-expect-error -- amount is a number
  place.by("ann", { amount: "3" });
  const inputs = legalInputs(sealedBids, s, "ann");
  const n: number = inputs[0]!.args.amount;
  void n;
});

test("a flow that starts with turns can be started after a setup that sets vars", () => {
  // Setup's events are matched against abilities, which reads the bound
  // actor before the turns frame has run once
  const { rules, turns, step } = define<{ n: number }>().withNodes(
    defaultNodes,
  );
  const game = rules({
    players: 2,
    setup: (tx) => void (tx.vars = { n: 0 }),
    flow: turns(
      { rounds: 1 },
      step((tx) => void tx.vars.n++),
    ),
  });
  assert.throws(
    () => init(game, { players: ["ann", "bob"], seed: "x" }),
    /without ending the game/,
    "runs both turns, then reports the missing end",
  );
});
