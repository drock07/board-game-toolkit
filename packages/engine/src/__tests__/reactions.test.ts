// Rung 9c: reactions while players act at once. By default a reaction
// pauses only the fiber that caused it; `pause: "everyone"` holds the rest.
// A player can have two prompts open (their own and a reaction on someone
// else's fiber); an input goes to the one that offers its action.
import { assert, test } from "vitest";
import {
  actors,
  defaultNodes,
  define,
  entity,
  init,
  legalInputs,
  zone,
} from "../index.js";
import { applyOrThrow, fuzz } from "../testing/index.js";

interface Chip {
  trap: boolean;
}
interface Vars {
  dodged: number;
}

const chip = entity<Chip>("chip");
const pile = zone("pile", { holds: chip, visibility: "hidden" });
const hand = zone("hand", {
  holds: chip,
  perPlayer: true,
  visibility: "owner",
});

/** Both players draw at once, then stop. A trap drawn must be disarmed; a poke may be dodged. */
function game(pause?: "everyone") {
  const { rules, action, ability, effect, prompt, seq, step, simultaneous } =
    define<Vars>({ zones: [pile, hand] }).withNodes(defaultNodes);
  const poke = effect<{ target: string }>("poke");
  const trap = ability({
    of: chip,
    where: (c) => c.props.trap,
    in: hand,
    on: "enters",
    ...(pause && { pause }),
    then: (t) =>
      prompt(
        action("disarm", {
          execute: (tx) => tx.move(t.self(tx).id, pile),
        }),
      ),
  });
  const dodge = ability({
    on: poke.before,
    who: (_s, p) => p.target,
    then: () =>
      prompt(action("dodge", { execute: (tx) => void tx.vars.dodged++ })),
  });
  return rules({
    players: 2,
    setup: (tx) => {
      tx.vars = { dodged: 0 };
      // Created in order, top first: the first draw is the trap
      tx.create(chip, { trap: true }, pile);
      for (let i = 0; i < 6; i++) tx.create(chip, { trap: false }, pile);
    },
    abilities: [trap, dodge],
    flow: seq(
      simultaneous(
        seq(
          prompt(
            action("draw", {
              execute: (tx, actor) => void tx.moveTop(pile, hand.of(actor)),
            }),
            action("poke", {
              execute: (tx, actor) =>
                tx.cause(poke, {
                  target: tx.players.find((p) => p !== actor)!,
                }),
            }),
          ),
          prompt(action("stop", { execute: () => {} })),
        ),
      ),
      step((tx) => tx.end()),
    ),
  });
}

const actionsOf = (
  g: ReturnType<typeof game>,
  s: ReturnType<typeof init>,
  p: string,
) =>
  legalInputs(g, s as never, p)
    .map((i) => i.action)
    .sort();

test("by default a reaction pauses only the fiber that caused it", () => {
  const g = game();
  let s = init(g, { players: ["ann", "bob"], seed: "x" });
  s = applyOrThrow(g, s, g.action("draw").by("ann"));
  assert.deepEqual(actionsOf(g, s, "ann"), ["disarm"]);
  assert.deepEqual(actionsOf(g, s, "bob"), ["draw", "poke"], "bob carries on");
  s = applyOrThrow(g, s, g.action("draw").by("bob"));
  assert.deepEqual(actionsOf(g, s, "bob"), ["stop"]);
});

test('pause: "everyone" holds every other fiber until the reaction is done', () => {
  const g = game("everyone");
  let s = init(g, { players: ["ann", "bob"], seed: "x" });
  s = applyOrThrow(g, s, g.action("draw").by("ann"));
  assert.deepEqual(actors(g, s), ["ann"]);
  assert.deepEqual(actionsOf(g, s, "bob"), [], "bob waits");
  s = applyOrThrow(g, s, g.action("disarm").by("ann"));
  assert.deepEqual(actionsOf(g, s, "bob"), ["draw", "poke"]);
});

test("a player with two prompts open: each input goes to the prompt that offers it", () => {
  const g = game();
  let s = init(g, { players: ["ann", "bob"], seed: "x" });
  // ann pokes bob: bob's dodge waits on ann's fiber while bob's own prompt is open
  s = applyOrThrow(g, s, g.action("poke").by("ann"));
  assert.deepEqual(actionsOf(g, s, "bob"), ["dodge", "draw", "poke"]);
  assert.deepEqual(
    actionsOf(g, s, "ann"),
    [],
    "ann's fiber waits on bob's reaction",
  );
  s = applyOrThrow(g, s, g.action("draw").by("bob"));
  assert.deepEqual(
    actionsOf(g, s, "bob"),
    ["disarm", "dodge"],
    "own draw went to bob's fiber",
  );
  s = applyOrThrow(g, s, g.action("dodge").by("bob"));
  assert.strictEqual(s.vars.dodged, 1);
  assert.deepEqual(actionsOf(g, s, "ann"), ["stop"], "ann's fiber moved on");
});

test("fuzz: both modes finish and replay", () => {
  for (const g of [game(), game("everyone")]) {
    const report = fuzz(g, {
      seeds: 30,
      players: ["ann", "bob"],
      maxInputs: 40,
    });
    assert.deepEqual(report.failures, []);
    assert.strictEqual(report.finished, 30);
  }
});
