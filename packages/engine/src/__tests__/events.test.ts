// Rung 9: events. A tiny game that touches every event type, with a hidden
// deck, owner-only hands, an update while hidden and a whispered emit.
import { assert, test } from "vitest";
import {
  apply,
  defaultNodes,
  define,
  entity,
  event,
  init,
  replay,
  view,
  viewEvents,
  zone,
} from "../index.js";
import { applyOrThrow, checkEvents, fuzz } from "../testing/index.js";

interface Card {
  rank: number;
  marked: boolean;
}
interface Vars {
  draws: number;
}

const card = entity<Card>("card");
const drew = event<{ id: string | undefined }>("drew");
const deck = zone("deck", { holds: card, visibility: "hidden" });
const hand = zone("hand", {
  holds: card,
  perPlayer: true,
  visibility: "owner",
});
const table = zone("table", { holds: card });

const { rules, action, seq, step, turns, prompt } = define<Vars>({
  zones: [deck, hand, table],
}).withNodes(defaultNodes);

const game = rules({
  players: 2,
  setup: (tx) => {
    tx.vars = { draws: 0 };
    for (let rank = 1; rank <= 6; rank++)
      tx.create(card, { rank, marked: false }, deck);
    tx.shuffle(deck);
  },
  flow: seq(
    turns(
      { until: (s) => s.count(deck) === 0 },
      prompt(
        action("draw", {
          execute: (tx, actor) => {
            const [id] = tx.moveTop(deck, hand.of(actor));
            tx.update(tx.entities(hand.of(actor))[0]!, { marked: true });
            tx.vars.draws++;
            tx.emit(drew, { id }, { to: [actor] });
            if (tx.count(hand.of(actor)) === 2) {
              tx.move(tx.entities(hand.of(actor)).at(-1)!.id, table);
              tx.flip(tx.entities(table)[0]!.id, false);
            }
          },
        }),
      ),
    ),
    step((tx) => tx.end({ draws: tx.vars.draws })),
  ),
});
const draw = game.action("draw");

test("an illegal input is a result, not an error", () => {
  const s = init(game, { players: ["ann", "bob"], seed: "x" });
  const out = apply(game, s, draw.by("bob"));
  assert.deepEqual(out, { ok: false, reason: "It is ann's turn, not bob's" });
});

test("a draw: the drawer sees the card, the other player a placeholder", () => {
  const s = init(game, { players: ["ann", "bob"], seed: "x" });
  const out = apply(game, s, draw.by("ann"));
  assert.ok(out.ok);
  assert.deepEqual(
    out.events.map((e) => e.type),
    ["moved", "updated", "custom", "vars"],
  );
  const mine = viewEvents(game, out.events, "ann");
  const theirs = viewEvents(game, out.events, "bob");
  assert.deepEqual(
    mine.map((e) => e.type),
    ["moved", "updated", "custom", "vars"],
  );
  // bob learns a card moved, not which one or that it was marked
  assert.deepEqual(
    theirs.map((e) => e.type),
    ["moved", "vars"],
  );
  const moved = theirs[0]!;
  assert.ok(moved.type === "moved" && "hidden" in moved.entities[0]!);
  assert.deepEqual(
    replay(view(game, s, "bob"), theirs),
    view(game, out.state, "bob"),
  );
  checkEvents(game, s, out.events, out.state);
});

test("the ending input carries the result", () => {
  let s = init(game, { players: ["ann", "bob"], seed: "y" });
  for (let i = 0; i < 5; i++)
    s = applyOrThrow(game, s, draw.by(i % 2 ? "bob" : "ann"));
  const out = apply(game, s, draw.by("bob"));
  assert.ok(out.ok);
  assert.deepEqual(out.events.at(-1), { type: "ended", result: { draws: 6 } });
  assert.deepEqual(
    replay(view(game, s, "ann"), viewEvents(game, out.events, "ann")).result,
    {
      draws: 6,
    },
  );
});

test("a shuffle renews refs, so creation order can't be followed", () => {
  // Setup creates ranks 1..6 as r1..r6, then shuffles the deck
  const s = init(game, { players: ["ann", "bob"], seed: "x" });
  const deckRefs = view(game, s, "bob").zones.deck!;
  assert.deepEqual(deckRefs, ["r7", "r8", "r9", "r10", "r11", "r12"]);
  for (const ref of deckRefs)
    assert.deepEqual(view(game, s, "bob").entities[ref], {
      ref,
      zone: "deck",
      hidden: true,
    });
  // The real ids and ranks are still shuffled underneath
  assert.ok(
    s.zones.deck!.map((id) => (s.entities[id]!.props as Card).rank).join() !==
      "1,2,3,4,5,6",
  );
});

test("checkEvents catches a leaked event", () => {
  const s = init(game, { players: ["ann", "bob"], seed: "x" });
  const out = apply(game, s, draw.by("ann"));
  assert.ok(out.ok);
  // Drop the vars snapshot: the replay no longer reaches the new state
  assert.throws(
    () =>
      checkEvents(
        game,
        s,
        out.events.filter((e) => e.type !== "vars"),
        out.state,
      ),
    /new state/,
  );
});

test("fuzz: events replay to every state and every view", () => {
  const report = fuzz(game, {
    seeds: 30,
    players: ["ann", "bob"],
    maxInputs: 20,
  });
  assert.deepEqual(report.failures, []);
  assert.strictEqual(report.finished, 30);
});
