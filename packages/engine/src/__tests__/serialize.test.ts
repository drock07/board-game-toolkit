// Saves, specs and replays: a state saved anywhere (mid-turn, mid-reaction,
// with fibers running) loads and plays on identically, and a save from a
// different build of the game is refused.
import { assert, test } from "vitest";
import {
  apply,
  fromJSON,
  init,
  legalInputs,
  load,
  replayInputs,
  save,
  SaveError,
  specHash,
  toJSON,
  type State,
} from "../index.js";
import { hashState, randomBot, record } from "../testing/index.js";
import { azul } from "./azul.js";
import { blackjackAtOnce } from "./blackjackAtOnce.js";
import { duel } from "./duel.js";

const inInterrupt = <V>(s: State<V>) =>
  [s.flow, ...Object.values(s.fibers).map((f) => f.stack)].some((stack) =>
    stack.some((f) => /^(ability|effect)/.test(f.id)),
  );

test("a spec survives toJSON and fromJSON", () => {
  for (const game of [duel, azul, blackjackAtOnce])
    assert.deepEqual(fromJSON(toJSON(game.spec)), game.spec);
});

test("the spec hash is stable across builds and tells games apart", () => {
  assert.strictEqual(specHash(duel), specHash({ ...duel }));
  assert.notStrictEqual(specHash(duel), specHash(azul));
});

test("a save taken mid-reaction loads and plays on to the same end", () => {
  const bot = randomBot("save");
  let found = false;
  for (let seed = 0; seed < 20 && !found; seed++) {
    let s = init(duel, { players: ["p1", "p2"], seed: `s${seed}` });
    for (let i = 0; i < 200 && s.status === "running"; i++) {
      if (inInterrupt(s)) {
        found = true;
        break;
      }
      const out = apply(duel, s, bot(legalInputs(duel, s)));
      assert.ok(out.ok);
      s = out.state;
    }
    if (!found) continue;
    let a = s;
    let b = load(duel, save(duel, s));
    assert.deepEqual(b, a);
    const rest = randomBot(`rest${seed}`);
    while (a.status === "running") {
      const input = rest(legalInputs(duel, a));
      const x = apply(duel, a, input);
      const y = apply(duel, b, input);
      assert.ok(x.ok && y.ok);
      assert.deepEqual(y.events, x.events);
      [a, b] = [x.state, y.state];
    }
    assert.strictEqual(hashState(b), hashState(a));
  }
  assert.ok(found, "some seed reaches a state inside an ability or effect");
});

test("a save with fibers running loads intact", () => {
  let s = init(blackjackAtOnce, { players: ["ann", "bob", "cat"], seed: "f" });
  const out = apply(blackjackAtOnce, s, legalInputs(blackjackAtOnce, s)[0]!);
  assert.ok(out.ok);
  s = out.state;
  assert.ok(Object.keys(s.fibers).length > 0, "fibers are running");
  assert.deepEqual(load(blackjackAtOnce, save(blackjackAtOnce, s)), s);
});

test("load refuses what isn't a save of this game", () => {
  const s = init(duel, { players: ["p1", "p2"], seed: "x" });
  const text = save(duel, s);
  assert.throws(() => load(azul, text), SaveError, /different version/);
  assert.throws(() => load(duel, "{"), SaveError, /Not JSON/);
  assert.throws(() => load(duel, toJSON(duel.spec)), SaveError, /Not a/);
  const newer = text.replace('"formatVersion":2', '"formatVersion":3');
  assert.throws(
    () => load(duel, newer),
    SaveError,
    /version 3 isn't supported/,
  );
});

test("a recorded game replays from its inputs to the same state", () => {
  const bot = randomBot("golden");
  const { golden, states } = record(
    azul,
    { players: ["ann", "bob"], seed: "g", maxInputs: 60 },
    (s) => bot(legalInputs(azul, s)),
  );
  assert.ok(golden.inputs.length > 10);
  const replayed = replayInputs(azul, golden, golden.inputs);
  assert.deepEqual(replayed, states.at(-1));
  assert.strictEqual(hashState(replayed), golden.finalStateHash);
});

test("a log that doesn't replay names the input that failed", () => {
  const s = init(duel, { players: ["p1", "p2"], seed: "x" });
  const [first] = legalInputs(duel, s);
  assert.throws(
    () =>
      replayInputs(duel, { players: ["p1", "p2"], seed: "x" }, [
        first!,
        { ...first!, player: "p1" },
      ]),
    SaveError,
    /Input 1 \(.+ by p1\) was rejected/,
  );
});
