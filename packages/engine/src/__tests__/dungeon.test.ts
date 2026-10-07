import { assert, test } from "vitest";
import type { State } from "../index.js";
import {
  current,
  defaultNodes,
  define,
  init,
  legalInputs,
  type GameInput,
} from "../index.js";
import { applyOrThrow, fuzz, randomBot } from "../testing/index.js";
import { dungeonCrawl, SIZE, type Vars } from "./dungeon.js";
import { turnNode } from "./turn.js";

const move = dungeonCrawl.action("move");
const attack = dungeonCrawl.action("attack");
const flee = dungeonCrawl.action("flee");
const skip = dungeonCrawl.action("skip");
type Input = GameInput<typeof dungeonCrawl>;

const players = ["p1"];
const roomAt = (s: { vars: Vars }) =>
  s.vars.grid[s.vars.player.row]![s.vars.player.col]!;
const inFlow = (s: { flow: { id: string }[] }, kind: string) =>
  s.flow.some((f) => f.id.startsWith(kind));

/** Moves until the room entered has `type`, or gives up after `max` moves. */
function moveUntil(s: State<Vars>, type: string, max = 40) {
  const bot = randomBot("walk");
  for (let i = 0; i < max && s.status === "running"; i++) {
    const moves = legalInputs(dungeonCrawl, s).filter(move.is);
    if (moves.length === 0) return s;
    s = applyOrThrow(dungeonCrawl, s, bot(moves) as Input);
    if (
      roomAt(s).type === type &&
      (type !== "monster" || (roomAt(s).monster?.hp ?? 0) > 0)
    )
      return s;
    // leave whatever we walked into
    while (
      s.status === "running" &&
      !legalInputs(dungeonCrawl, s).some(move.is)
    ) {
      const legal = legalInputs(dungeonCrawl, s);
      s = applyOrThrow(dungeonCrawl, s, legal.find(skip.is) ?? bot(legal));
    }
  }
  return s;
}

test("lowers outcomes, branch and a reused combat subflow", () => {
  const spec = JSON.stringify(dungeonCrawl.spec.flow);
  assert.ok(spec.includes('"kind":"outcomes"'));
  assert.ok(spec.includes('"kind":"branch"'));
  assert.deepEqual(Object.keys(dungeonCrawl.kinds).sort(), [
    "branch",
    "loop",
    "outcomes",
    "seq",
    "step",
    "turn",
  ]);
  const conds = Object.keys(dungeonCrawl.impl.conditions);
  assert.ok(
    conds.includes("outcomes.defeat") && conds.includes("outcomes.victory"),
  );
  assert.ok(conds.includes("outcomes2.killed"), "combat's guard");
  assert.ok(
    !("outcomes2.fled" in dungeonCrawl.impl.conditions),
    "fled has no guard; it's raised",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(dungeonCrawl.spec)),
    dungeonCrawl.spec,
  );
});

test("starts in the corner with two moves and no potions", () => {
  const s = init(dungeonCrawl, { players, seed: "d" });
  assert.deepEqual(s.vars.player, {
    row: 0,
    col: 0,
    hp: 20,
    maxHp: 20,
    attack: 0,
    defense: 0,
    inventory: [],
    equipment: [],
  });
  assert.deepEqual(
    legalInputs(dungeonCrawl, s).map((i) => i.args),
    [
      { row: 1, col: 0 },
      { row: 0, col: 1 },
    ],
  );
  assert.ok(s.vars.grid[SIZE - 1]![SIZE - 1]!.monster?.name === "Dragon");
});

test("a monster room enters combat; killing the monster fires the guard and runs its handler", () => {
  let s = moveUntil(init(dungeonCrawl, { players, seed: "fight" }), "monster");
  assert.strictEqual(roomAt(s).type, "monster");
  assert.ok(inFlow(s, "outcomes2"), "inside combat");
  assert.deepEqual(
    new Set(legalInputs(dungeonCrawl, s).map((i) => i.action)),
    new Set(["attack", "flee"]),
  );
  while (s.status === "running" && inFlow(s, "outcomes2"))
    s = applyOrThrow(dungeonCrawl, s, attack.by("p1"));
  if (s.status === "running") {
    assert.strictEqual(roomAt(s).monster?.hp, 0);
    assert.ok(
      s.vars.log.some((l) => l.endsWith("defeated!")),
      "the killed handler ran",
    );
    assert.ok(legalInputs(dungeonCrawl, s).some(move.is), "back to exploring");
    assert.ok(
      !s.flow.some(
        (f) =>
          typeof f.data === "object" && f.data !== null && "handling" in f.data,
      ),
      "the combat frame is gone",
    );
  } else {
    assert.strictEqual((s.result as { result: string }).result, "defeat");
  }
});

test("fleeing raises an outcome from an action; the combat node catches it", () => {
  let s = moveUntil(init(dungeonCrawl, { players, seed: "flee" }), "monster");
  assert.ok(inFlow(s, "outcomes2"));
  const hp = () => s.vars.player.hp;
  while (s.status === "running" && inFlow(s, "outcomes2"))
    s = applyOrThrow(dungeonCrawl, s, flee.by("p1"));
  if (s.status === "running") {
    assert.ok(s.vars.log.includes("You escaped!"));
    assert.ok((roomAt(s).monster?.hp ?? 0) > 0, "the monster lives");
    assert.ok(legalInputs(dungeonCrawl, s).some(move.is));
  } else {
    assert.strictEqual(hp(), 0);
  }
});

test("random runs end in victory or defeat; defeat fires mid-combat from the outer guard", () => {
  const report = fuzz(dungeonCrawl, { seeds: 40, players, maxInputs: 400 });
  assert.deepEqual(report.failures, []);
  const results = { victory: 0, defeat: 0 };
  for (let i = 0; i < 40; i++) {
    const bot = randomBot(`fuzz-${i}`);
    let s = init(dungeonCrawl, { players, seed: `fuzz-${i}` });
    for (let n = 0; n < 400 && s.status === "running"; n++)
      s = applyOrThrow(dungeonCrawl, s, bot(legalInputs(dungeonCrawl, s)));
    if (s.status === "finished") {
      const r = s.result as { result: "victory" | "defeat"; log: string[] };
      results[r.result]++;
      if (r.result === "defeat") {
        assert.strictEqual(s.vars.player.hp, 0);
        assert.strictEqual(r.log.at(-1), "You have fallen in the dungeon...");
      }
      assert.ok(
        !s.flow.some(
          (f) => f.id.startsWith("outcomes") || f.id.startsWith("loop"),
        ),
        "the run's frames were cancelled",
      );
    }
  }
  assert.ok(results.defeat > 0, `defeats: ${results.defeat}`);
  assert.strictEqual(report.finished, results.victory + results.defeat);
});

test("types: exits and outcomes", () => {
  const { step, outcomes, loop, action, turn, branch } =
    define<Vars>().withNodes([...defaultNodes, turnNode]);
  step(() => ({ exit: "fled" }));
  // @ts-expect-error -- an exit names an outcome
  step(() => ({ exit: 1 }));
  const a = action("a", { execute: () => ({ exit: "x" }) });
  const n = outcomes(
    { x: { then: step(() => {}) }, y: { when: (s) => s.vars.player.hp < 0 } },
    loop({}, turn({}, a)),
  );
  const b = branch([{ when: () => true, then: n }]);
  void b;
  void current;
});
