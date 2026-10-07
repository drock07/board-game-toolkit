// Effects register themselves: a game gets every effect declared on its core
// before `rules`, whether or not an ability reacts to it.
import { assert, test } from "vitest";
import { apply, defaultNodes, define, init, type Effect } from "../index.js";
import { applyOrThrow } from "../testing/index.js";

interface Vars {
  log: string[];
}

const build = () => {
  const core = define<Vars>().withNodes(defaultNodes);
  const noted = core.effect("noted", {
    resolve: (tx, d: { text: string }) => void tx.vars.log.push(d.text),
  });
  const game = core.rules({
    players: 1,
    setup: (tx) => void (tx.vars = { log: [] }),
    flow: core.loop(
      {},
      core.prompt(
        core.action("note", {
          execute: (tx) => tx.cause(noted, { text: "hi" }),
        }),
      ),
    ),
  });
  return { core, game };
};

test("an effect nobody reacts to resolves without being listed anywhere", () => {
  const { game } = build();
  const s = applyOrThrow(
    game,
    init(game, { players: ["ann"], seed: "x" }),
    game.action("note").by("ann"),
  );
  assert.deepEqual(s.vars.log, ["hi"]);
});

test("an effect declared after rules isn't in that game, and causing it says so", () => {
  const core = define<Vars>().withNodes(defaultNodes);
  // The action refers to an effect the file declares below `rules`
  const later: { late?: Effect<Vars, void> } = {};
  const game = core.rules({
    players: 1,
    setup: (tx) => void (tx.vars = { log: [] }),
    flow: core.prompt(
      core.action("go", { execute: (tx) => tx.cause(later.late!, undefined) }),
    ),
  });
  later.late = core.effect<void>("late");
  assert.ok(!game.spec.effects?.some((e) => e.name === "late"));
  const s = init(game, { players: ["ann"], seed: "x" });
  assert.throws(
    () => apply(game, s, game.action("go").by("ann")),
    /declare it with `effect` before calling `rules`/,
  );
});

test("two effects with one name fail where the second is declared", () => {
  const { core } = build();
  assert.throws(() => core.effect("noted"), /Two effects are named "noted"/);
});
