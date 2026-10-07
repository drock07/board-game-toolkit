import { assert, test } from "vitest";
import type { State } from "../index.js";
import {
  actors,
  check,
  defaultNodes,
  define,
  init,
  legalInputs,
} from "../index.js";
import { applyOrThrow, fuzz } from "../testing/index.js";
import {
  blackjackAtOnce,
  card,
  hand,
  total,
  type Vars as BlackjackVars,
} from "./blackjackAtOnce.js";

const players = ["ann", "bob", "cat"];
const hit = blackjackAtOnce.action("hit");
const stand = blackjackAtOnce.action("stand");
const handTotal = (s: State<BlackjackVars>, p: string) =>
  total(s.zones[hand.of(p).id]!.map((id) => s.entities[id]!).filter(card.is));

test("every player plays their hand at once, each on a fiber bound to them", () => {
  let s = init(blackjackAtOnce, { players, seed: "x" });
  assert.deepEqual(actors(blackjackAtOnce, s), players);
  assert.deepEqual(
    Object.values(s.fibers).map((f) => f.player),
    players,
  );
  assert.strictEqual(
    s.flow.at(-1)?.children?.length,
    3,
    "the simultaneous frame waits on three fibers",
  );
  // bob stands; ann hits; cat is untouched
  s = applyOrThrow(blackjackAtOnce, s, stand.by("bob"));
  assert.deepEqual(actors(blackjackAtOnce, s), ["ann", "cat"]);
  assert.strictEqual(
    check(blackjackAtOnce, s, hit.by("bob")),
    "bob has nothing to do right now",
  );
  const before = s.zones[hand.of("ann").id]!.length;
  s = applyOrThrow(blackjackAtOnce, s, hit.by("ann"));
  assert.strictEqual(
    s.zones[hand.of("ann").id]!.length,
    before + 1,
    "ann drew a card",
  );
  void handTotal;
  const annFiber = Object.values(s.fibers).find((f) => f.player === "ann");
  if (actors(blackjackAtOnce, s).includes("ann")) {
    assert.deepEqual(
      annFiber?.stack.at(-1)?.data,
      { answers: 1, counts: { hit: 1 } },
      "ann's turn frame counts her hit",
    );
  }
  assert.strictEqual(
    Object.values(s.fibers)
      .find((f) => f.player === "cat")
      ?.stack.at(-1)?.data,
    undefined,
    "cat's turn is untouched",
  );
  // Finish everyone; the dealer then plays and the game ends
  while (s.status === "running") {
    const [p] = actors(blackjackAtOnce, s);
    s = applyOrThrow(blackjackAtOnce, s, stand.by(p!));
  }
  assert.deepEqual(s.fibers, {}, "fibers are gone");
  assert.deepEqual(Object.keys(s.vars.results).sort(), players);
});

test("legal inputs cover every player's fiber; fuzz never breaks", () => {
  const s = init(blackjackAtOnce, { players, seed: "y" });
  assert.strictEqual(legalInputs(blackjackAtOnce, s).length, 6);
  assert.deepEqual(legalInputs(blackjackAtOnce, s, "cat"), [
    hit.by("cat"),
    stand.by("cat"),
  ]);
  const report = fuzz(blackjackAtOnce, { seeds: 50, players, maxInputs: 40 });
  assert.deepEqual(report.failures, []);
  assert.strictEqual(report.finished, 50);
});

test("an outcome escaping a fiber cancels its siblings; a guard cancels all of them", () => {
  interface Vars {
    log: string[];
    quits: number;
  }
  const { rules, action, seq, step, outcomes, simultaneous, turn } =
    define<Vars>().withNodes(defaultNodes);
  const game = rules({
    players: 3,
    setup: (tx) => {
      tx.vars = { log: [], quits: 0 };
    },
    flow: seq(
      outcomes(
        { quit: { then: step((tx) => void tx.vars.log.push("someone quit")) } },
        simultaneous(
          turn(
            {},
            action("quit", {
              execute: (tx) => {
                tx.vars.quits++;
                return { exit: "quit" };
              },
            }),
            action("stay", {
              execute: (tx, actor) => void tx.vars.log.push(`${actor} stays`),
            }),
            action("done", { execute: () => "end" }),
          ),
        ),
      ),
      outcomes(
        {
          tooMany: {
            when: (s) => s.vars.quits >= 2,
            then: step((tx) => void tx.vars.log.push("guard fired")),
          },
        },
        simultaneous(
          turn(
            {},
            action("quitAgain", { execute: (tx) => void tx.vars.quits++ }),
            action("rest", { execute: () => "end" }),
          ),
        ),
      ),
      step((tx) => tx.end(tx.vars.log)),
    ),
  });
  const quit = game.action("quit");
  const stay = game.action("stay");
  const quitAgain = game.action("quitAgain");
  let s = init(game, { players, seed: "q" });
  s = applyOrThrow(game, s, stay.by("ann"));
  s = applyOrThrow(game, s, quit.by("bob"));
  // The raise cancelled ann's and cat's fibers and ran the handler; now the second phase
  assert.deepEqual(s.vars.log, ["ann stays", "someone quit"]);
  assert.strictEqual(
    Object.values(s.fibers).length,
    3,
    "the second simultaneous spawned fresh fibers",
  );
  assert.deepEqual(actors(game, s), players);
  // bob's quit made it 1; cat's makes it 2: the outer guard fires from inside cat's fiber,
  // cancelling every fiber and running its handler
  s = applyOrThrow(game, s, quitAgain.by("cat"));
  assert.strictEqual(s.status, "finished");
  assert.deepEqual(s.result, ["ann stays", "someone quit", "guard fired"]);
});
