// Scopes are looked up by node: a second scoped kind inside an ability's
// handler doesn't hide the ability's scope, and a kind author's own typed
// accessor reads its node's scope the same way.
import { assert, test } from "vitest";
import {
  defaultNodes,
  define,
  entity,
  init,
  zone,
  type Node,
  type Scoped,
} from "../index.js";
import { defineNode, node, type Kind, type SpecNode } from "../kinds/index.js";
import { applyOrThrow } from "../testing/index.js";

/** `within(label, (w) => body)`: runs `body` once, showing it `label`. */
type WithinNode = {
  kind: "within";
  id: string;
  label: string;
  body: SpecNode;
};

export type WithinBuilder<V> = <H>(
  label: string,
  body: (w: { label: (s: Scoped) => string }) => Node<V, H>,
) => Node<V, H>;

declare module "../define/types.js" {
  interface NodeBuilders<V> {
    within: WithinBuilder<V>;
  }
}

const kind: Kind<WithinNode> = {
  children: (n) => [n.body],
  run: (n, f) => (f.i === 0 ? { pass: n.body } : "done"),
  scope: (n) => n.label,
};

const withinNode = defineNode("within", {
  build: (label, body) =>
    node(kind, (l) => {
      const id = l.id("within");
      const w = { label: (s: Scoped) => s.scopeOf(id) as string };
      return { kind: "within", id, label, body: l.visit(body(w)) };
    }),
});

interface Vars {
  seen: string[];
}
const card = entity<{ name: string }>("card");
const hand = zone("hand", { holds: card, perPlayer: true });

const { rules, action, effect, ability, prompt, loop, step, within } =
  define<Vars>({
    zones: [hand],
  }).withNodes([...defaultNodes, withinNode]);

const ping = effect<{ n: number }>("ping");

const echo = ability({
  of: card,
  in: hand,
  on: ping,
  then: (t) =>
    within("outer", (w) =>
      step((tx) => {
        tx.vars.seen.push(
          `${t.self(tx).props.name} ${t.data(tx).n} ${w.label(tx)}`,
        );
      }),
    ),
});

const game = rules({
  players: 1,
  setup: (tx) => {
    tx.vars = { seen: [] };
    tx.create(card, { name: "A" }, hand.of(tx.players[0]!));
  },
  abilities: [echo],
  flow: loop(
    {},
    prompt(action("ping", { execute: (tx) => tx.cause(ping, { n: 7 }) })),
  ),
});

test("an ability's scope survives a scoped kind inside its handler", () => {
  const s = applyOrThrow(
    game,
    init(game, { players: ["ann"], seed: "x" }),
    game.action("ping").by("ann"),
  );
  assert.deepEqual(s.vars.seen, ["A 7 outer"]);
});
