import { assert, test } from "vitest";
import {
  current,
  defaultNodes,
  define,
  init,
  legalInputs,
  view,
  type GameInput,
} from "../index.js";
import { applyOrThrow, fuzz, randomBot } from "../testing/index.js";
import { blackjack, card, deck, hand, total, type Vars } from "./blackjack.js";

const players = ["ann", "bob"];
const hit = blackjack.action("hit");
const stand = blackjack.action("stand");

test("lowers zones and the flow to a JSON spec", () => {
  assert.deepEqual(blackjack.spec.zones, {
    deck: { holds: "card", visibility: "hidden" },
    dealer: { holds: "card", visibility: "public" },
    hand: { holds: "card", visibility: "public", perPlayer: true },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(blackjack.spec)), blackjack.spec);
  const ids: string[] = [];
  const walk = (n: {
    id: string;
    children?: { id: string }[];
    body?: { id: string };
  }) => {
    ids.push(n.id);
    (n.children ?? (n.body ? [n.body] : [])).forEach((c) => walk(c));
  };
  walk(blackjack.spec.flow);
  assert.deepEqual(ids, ["seq", "step", "turns", "turn", "step2"]);
  assert.deepEqual(Object.keys(blackjack.impl.conditions), []);
  assert.deepEqual(Object.keys(blackjack.kinds).sort(), [
    "seq",
    "step",
    "turn",
    "turns",
  ]);
  assert.deepEqual(Object.keys(blackjack.impl.actions), ["hit", "stand"]);
});

test("deals, then waits on the first player with hit and stand", () => {
  const s = init(blackjack, { players, seed: "deal" });
  assert.strictEqual(s.zones.deck!.length, 52 - 6);
  for (const p of players)
    assert.strictEqual(s.zones[hand.of(p).id]!.length, 2);
  // Moves go on top, so the hole card (dealt last, face down) is first
  const [hole, up] = s.zones.dealer!;
  assert.strictEqual(s.entities[up!]!.faceUp, undefined);
  assert.strictEqual(s.entities[hole!]!.faceUp, false);
  assert.strictEqual(current(blackjack, s), "ann");
  assert.deepEqual(legalInputs(blackjack, s), [
    { player: "ann", action: "hit", args: undefined },
    { player: "ann", action: "stand", args: undefined },
  ]);
});

test("views hide the deck and the hole card, and show the hands", () => {
  const s = init(blackjack, { players, seed: "deal" });
  const v = view(blackjack, s, "ann");
  for (const ref of v.zones.deck!) assert.ok("hidden" in v.entities[ref]!);
  const [hole, up] = v.zones.dealer!;
  assert.ok(card.is(v.entities[up!]!));
  assert.ok("hidden" in v.entities[hole!]!);
  for (const p of players)
    for (const ref of v.zones[hand.of(p).id]!)
      assert.ok(card.is(v.entities[ref]!));
  const mine = v.zones[hand.of("ann").id]!.map(
    (ref) => v.entities[ref]!,
  ).filter(card.is);
  assert.strictEqual(mine.length, 2);
  const rank: number = mine[0]!.props.rank;
  void rank;
});

test("hit until 17 then stand, for both; the dealer plays and the game ends", () => {
  let s = init(blackjack, { players, seed: "play" });
  while (s.status === "running") {
    const me = current(blackjack, s)!;
    const mine = total(
      s.zones[hand.of(me).id]!.map((id) => s.entities[id]!).filter(card.is),
    );
    s = applyOrThrow(blackjack, s, mine < 17 ? hit.by(me) : stand.by(me));
  }
  const house = total(
    s.zones.dealer!.map((id) => s.entities[id]!).filter(card.is),
  );
  assert.ok(house >= 17);
  for (const id of s.zones.dealer!)
    assert.notStrictEqual(s.entities[id]!.faceUp, false);
  assert.deepEqual(s.result, s.vars.results);
  assert.deepEqual(Object.keys(s.vars.results).sort(), players);
  const v = view(blackjack, s, "bob");
  for (const ref of v.zones.dealer!) assert.ok(card.is(v.entities[ref]!));
});

test("a bust ends the turn; the turn frame counts its answers", () => {
  let s = init(blackjack, { players, seed: "bust" });
  let hits = 0;
  let checked = 0;
  while (current(blackjack, s) === "ann") {
    s = applyOrThrow(blackjack, s, hit.by("ann"));
    hits++;
    const frame = s.flow.find((f) => f.id === "turn");
    if (current(blackjack, s) === "ann") {
      assert.deepEqual(frame?.data, { answers: hits, counts: { hit: hits } });
      checked++;
    }
  }
  assert.ok(checked > 0, "the seed lets ann hit without busting at least once");
  assert.strictEqual(current(blackjack, s), "bob");
  assert.deepEqual(
    s.flow.find((f) => f.id === "turn")?.data,
    undefined,
    "bob's turn is a fresh frame",
  );
  assert.ok(
    total(
      s.zones[hand.of("ann").id]!.map((id) => s.entities[id]!).filter(card.is),
    ) > 21,
  );
});

test("types: handles carry their types", () => {
  const s = init(blackjack, { players, seed: "t" });
  // @ts-expect-error -- hit takes no args
  void (() => hit.by("ann", {}));
  // @ts-expect-error -- no such action
  void (() => blackjack.action("double"));
  define<Vars>()
    .withNodes(defaultNodes)
    .step((tx) => {
      tx.create(card, { rank: 1, suit: "♠" }, deck);
      // @ts-expect-error -- a card needs a suit
      tx.create(card, { rank: 1 }, deck);
      // @ts-expect-error -- a per-player zone needs `.of(player)`
      tx.moveTop(deck, hand);
      const cards = tx.entities(hand.of("ann"));
      const r: number = cards[0]!.props.rank;
      void r;
    });
  const input: GameInput<typeof blackjack> = stand.by("ann");
  void input;
  void s;
});

test("fuzz: random play finishes, views never leak", () => {
  const report = fuzz(blackjack, { seeds: 100, players, maxInputs: 30 });
  assert.deepEqual(report.failures, []);
  assert.strictEqual(report.finished, 100);
  let s = init(blackjack, { players: ["solo"], seed: "r" });
  const bot = randomBot("r");
  while (s.status === "running")
    s = applyOrThrow(
      blackjack,
      s,
      bot(legalInputs(blackjack, s)) as GameInput<typeof blackjack>,
    );
  assert.strictEqual(s.status, "finished");
});
