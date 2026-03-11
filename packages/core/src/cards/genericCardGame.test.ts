import { describe, expect, it } from "vitest";
import {
  type GenericCardGameState,
  type GenericCardInstance,
  removeFromPool,
  addToPool,
  drawFromPool,
  shufflePool,
  moveCard,
  drawToPool,
  findInPool,
  dealFromPool,
  peekPool,
  sortPool,
  countInPool,
  splitPool,
  swapCards,
} from "./genericCardGame";

// --- helpers ---

interface TestCard extends GenericCardInstance {
  value: number;
}

type TestPoolId = "deck" | "hand" | "discard" | "p1" | "p2" | "p3";

function card(id: string, value: number = 0): TestCard {
  return { id, value };
}

function makeState(
  pools: Partial<Record<TestPoolId, TestCard[]>>,
): GenericCardGameState<TestPoolId, TestCard> {
  return {
    pools: {
      deck: [],
      hand: [],
      discard: [],
      p1: [],
      p2: [],
      p3: [],
      ...pools,
    },
  };
}

// --- tests ---

describe("removeFromPool", () => {
  it("removes a card by id", () => {
    const state = makeState({ hand: [card("a"), card("b"), card("c")] });
    const result = removeFromPool(state, "hand", "b");
    expect(result.pools.hand).toEqual([card("a"), card("c")]);
  });

  it("returns state unchanged if card not found", () => {
    const state = makeState({ hand: [card("a")] });
    const result = removeFromPool(state, "hand", "z");
    expect(result).toBe(state);
  });

  it("does not mutate the original state", () => {
    const state = makeState({ hand: [card("a"), card("b")] });
    removeFromPool(state, "hand", "a");
    expect(state.pools.hand).toEqual([card("a"), card("b")]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => removeFromPool(state, "nope", "a")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("addToPool", () => {
  it("adds a single card to the bottom by default", () => {
    const state = makeState({ hand: [card("a")] });
    const result = addToPool(state, "hand", card("b"));
    expect(result.pools.hand).toEqual([card("a"), card("b")]);
  });

  it("adds multiple cards to the bottom", () => {
    const state = makeState({ hand: [card("a")] });
    const result = addToPool(state, "hand", [card("b"), card("c")]);
    expect(result.pools.hand).toEqual([card("a"), card("b"), card("c")]);
  });

  it("adds to the top", () => {
    const state = makeState({ hand: [card("a"), card("b")] });
    const result = addToPool(state, "hand", card("z"), "top");
    expect(result.pools.hand[0]).toEqual(card("z"));
  });

  it("adds at a numeric index", () => {
    const state = makeState({ hand: [card("a"), card("c")] });
    const result = addToPool(state, "hand", card("b"), 1);
    expect(result.pools.hand).toEqual([card("a"), card("b"), card("c")]);
  });

  it("adds at random position without losing cards", () => {
    const state = makeState({ hand: [card("a"), card("b"), card("c")] });
    const result = addToPool(state, "hand", card("z"), "random");
    expect(result.pools.hand).toHaveLength(4);
    expect(result.pools.hand).toContainEqual(card("z"));
  });

  it("does not mutate the original state", () => {
    const state = makeState({ hand: [card("a")] });
    addToPool(state, "hand", card("b"));
    expect(state.pools.hand).toEqual([card("a")]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => addToPool(state, "nope", card("a"))).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("drawFromPool", () => {
  it("draws a single card without count", () => {
    const state = makeState({ deck: [card("a"), card("b"), card("c")] });
    const [drawn, newState] = drawFromPool(state, "deck");
    expect(drawn).toEqual(card("a"));
    expect(newState.pools.deck).toEqual([card("b"), card("c")]);
  });

  it("draws multiple cards with count", () => {
    const state = makeState({ deck: [card("a"), card("b"), card("c")] });
    const [drawn, newState] = drawFromPool(state, "deck", 2);
    expect(drawn).toEqual([card("a"), card("b")]);
    expect(newState.pools.deck).toEqual([card("c")]);
  });

  it("draws with reshuffle when pool is too small", () => {
    const state = makeState({
      deck: [card("a")],
      discard: [card("b"), card("c")],
    });
    const [drawn, newState] = drawFromPool(state, "deck", 2, "discard");
    expect(drawn).toHaveLength(2);
    expect(drawn[0]).toEqual(card("a"));
    expect(newState.pools.discard).toEqual([]);
  });

  it("draws single card with reshuffle pool id", () => {
    const state = makeState({
      deck: [card("a"), card("b")],
      discard: [card("c")],
    });
    const [drawn, newState] = drawFromPool(state, "deck", "discard");
    expect(drawn).toEqual(card("a"));
    expect(newState.pools.deck).toEqual([card("b")]);
    expect(newState.pools.discard).toEqual([card("c")]);
  });

  it("throws when drawing from empty pool", () => {
    const state = makeState({ deck: [] });
    expect(() => drawFromPool(state, "deck")).toThrow();
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => drawFromPool(state, "nope")).toThrow(
      'Pool "nope" does not exist',
    );
  });

  it("does not mutate the original state", () => {
    const state = makeState({ deck: [card("a"), card("b")] });
    drawFromPool(state, "deck");
    expect(state.pools.deck).toEqual([card("a"), card("b")]);
  });
});

describe("shufflePool", () => {
  it("returns pool with same cards in potentially different order", () => {
    const cards = [card("a"), card("b"), card("c"), card("d"), card("e")];
    const state = makeState({ deck: cards });
    const result = shufflePool(state, "deck");
    expect(result.pools.deck).toHaveLength(5);
    expect(result.pools.deck.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      cards.sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("does not mutate the original state", () => {
    const state = makeState({ deck: [card("a"), card("b")] });
    shufflePool(state, "deck");
    expect(state.pools.deck).toEqual([card("a"), card("b")]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => shufflePool(state, "nope")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("moveCard", () => {
  it("moves a card from one pool to another", () => {
    const state = makeState({
      hand: [card("a"), card("b")],
      discard: [],
    });
    const result = moveCard(state, "hand", "discard", "a");
    expect(result.pools.hand).toEqual([card("b")]);
    expect(result.pools.discard).toEqual([card("a")]);
  });

  it("moves to top position", () => {
    const state = makeState({
      hand: [card("a")],
      discard: [card("x"), card("y")],
    });
    const result = moveCard(state, "hand", "discard", "a", "top");
    expect(result.pools.discard[0]).toEqual(card("a"));
  });

  it("returns state unchanged if card not found", () => {
    const state = makeState({ hand: [card("a")], discard: [] });
    const result = moveCard(state, "hand", "discard", "z");
    expect(result).toBe(state);
  });

  it("throws if source pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => moveCard(state, "nope", "hand", "a")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("drawToPool", () => {
  it("draws one card by default and adds to target", () => {
    const state = makeState({
      deck: [card("a"), card("b")],
      hand: [],
    });
    const result = drawToPool(state, "deck", "hand");
    expect(result.pools.deck).toEqual([card("b")]);
    expect(result.pools.hand).toEqual([card("a")]);
  });

  it("draws multiple cards into target", () => {
    const state = makeState({
      deck: [card("a"), card("b"), card("c")],
      hand: [],
    });
    const result = drawToPool(state, "deck", "hand", 2);
    expect(result.pools.deck).toEqual([card("c")]);
    expect(result.pools.hand).toEqual([card("a"), card("b")]);
  });

  it("respects position parameter", () => {
    const state = makeState({
      deck: [card("a")],
      hand: [card("x"), card("y")],
    });
    const result = drawToPool(state, "deck", "hand", 1, "top");
    expect(result.pools.hand[0]).toEqual(card("a"));
  });

  it("throws when not enough cards", () => {
    const state = makeState({ deck: [], hand: [] });
    expect(() => drawToPool(state, "deck", "hand")).toThrow();
  });
});

describe("findInPool", () => {
  it("returns matching cards", () => {
    const state = makeState({
      hand: [card("a", 1), card("b", 2), card("c", 1)],
    });
    const result = findInPool(state, "hand", (c) => c.value === 1);
    expect(result).toEqual([card("a", 1), card("c", 1)]);
  });

  it("returns empty array when no matches", () => {
    const state = makeState({ hand: [card("a", 1)] });
    const result = findInPool(state, "hand", (c) => c.value === 99);
    expect(result).toEqual([]);
  });

  it("does not modify state", () => {
    const state = makeState({ hand: [card("a", 1), card("b", 2)] });
    findInPool(state, "hand", (c) => c.value === 1);
    expect(state.pools.hand).toEqual([card("a", 1), card("b", 2)]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => findInPool(state, "nope", () => true)).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("dealFromPool", () => {
  it("deals cards round-robin to target pools", () => {
    const state = makeState({
      deck: [card("1"), card("2"), card("3"), card("4"), card("5"), card("6")],
      p1: [],
      p2: [],
      p3: [],
    });
    const result = dealFromPool(state, "deck", ["p1", "p2", "p3"], 2);
    // Round 1: p1 gets 1, p2 gets 2, p3 gets 3
    // Round 2: p1 gets 4, p2 gets 5, p3 gets 6
    expect(result.pools.p1).toEqual([card("1"), card("4")]);
    expect(result.pools.p2).toEqual([card("2"), card("5")]);
    expect(result.pools.p3).toEqual([card("3"), card("6")]);
    expect(result.pools.deck).toEqual([]);
  });

  it("throws when not enough cards to deal", () => {
    const state = makeState({ deck: [card("a")], p1: [], p2: [] });
    expect(() => dealFromPool(state, "deck", ["p1", "p2"], 2)).toThrow();
  });

  it("does not mutate the original state", () => {
    const state = makeState({
      deck: [card("a"), card("b")],
      p1: [],
      p2: [],
    });
    dealFromPool(state, "deck", ["p1", "p2"], 1);
    expect(state.pools.deck).toEqual([card("a"), card("b")]);
  });

  it("throws if source pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => dealFromPool(state, "nope", ["hand"], 1)).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("peekPool", () => {
  it("returns the top card by default", () => {
    const state = makeState({ deck: [card("a"), card("b"), card("c")] });
    const result = peekPool(state, "deck");
    expect(result).toEqual([card("a")]);
  });

  it("returns the top N cards", () => {
    const state = makeState({ deck: [card("a"), card("b"), card("c")] });
    const result = peekPool(state, "deck", 2);
    expect(result).toEqual([card("a"), card("b")]);
  });

  it("returns all cards if count exceeds pool size", () => {
    const state = makeState({ deck: [card("a")] });
    const result = peekPool(state, "deck", 5);
    expect(result).toEqual([card("a")]);
  });

  it("returns empty array for empty pool", () => {
    const state = makeState({ deck: [] });
    const result = peekPool(state, "deck");
    expect(result).toEqual([]);
  });

  it("does not modify state", () => {
    const state = makeState({ deck: [card("a"), card("b")] });
    peekPool(state, "deck");
    expect(state.pools.deck).toEqual([card("a"), card("b")]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => peekPool(state, "nope")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("sortPool", () => {
  it("sorts cards by comparator", () => {
    const state = makeState({
      hand: [card("c", 3), card("a", 1), card("b", 2)],
    });
    const result = sortPool(state, "hand", (a, b) => a.value - b.value);
    expect(result.pools.hand).toEqual([
      card("a", 1),
      card("b", 2),
      card("c", 3),
    ]);
  });

  it("does not mutate the original state", () => {
    const original = [card("c", 3), card("a", 1)];
    const state = makeState({ hand: original });
    sortPool(state, "hand", (a, b) => a.value - b.value);
    expect(state.pools.hand).toEqual([card("c", 3), card("a", 1)]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => sortPool(state, "nope", () => 0)).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("countInPool", () => {
  it("returns total count without predicate", () => {
    const state = makeState({ hand: [card("a"), card("b"), card("c")] });
    expect(countInPool(state, "hand")).toBe(3);
  });

  it("returns 0 for empty pool", () => {
    const state = makeState({ hand: [] });
    expect(countInPool(state, "hand")).toBe(0);
  });

  it("returns filtered count with predicate", () => {
    const state = makeState({
      hand: [card("a", 1), card("b", 2), card("c", 1)],
    });
    expect(countInPool(state, "hand", (c) => c.value === 1)).toBe(2);
  });

  it("returns 0 when no cards match predicate", () => {
    const state = makeState({ hand: [card("a", 1)] });
    expect(countInPool(state, "hand", (c) => c.value === 99)).toBe(0);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => countInPool(state, "nope")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("splitPool", () => {
  it("partitions cards into target pools", () => {
    const state = makeState({
      deck: [card("a", 1), card("b", 2), card("c", 1), card("d", 2)],
      p1: [],
      p2: [],
    });
    const result = splitPool(state, "deck", ["p1", "p2"], (c) =>
      c.value === 1 ? "p1" : "p2",
    );
    expect(result.pools.p1).toEqual([card("a", 1), card("c", 1)]);
    expect(result.pools.p2).toEqual([card("b", 2), card("d", 2)]);
    expect(result.pools.deck).toEqual([]);
  });

  it("keeps cards in source pool when assignFn returns null", () => {
    const state = makeState({
      deck: [card("a", 1), card("b", 2), card("c", 3)],
      p1: [],
    });
    const result = splitPool(state, "deck", ["p1"], (c) =>
      c.value === 1 ? "p1" : null,
    );
    expect(result.pools.p1).toEqual([card("a", 1)]);
    expect(result.pools.deck).toEqual([card("b", 2), card("c", 3)]);
  });

  it("keeps cards when assignFn returns an id not in targetPoolIds", () => {
    const state = makeState({
      deck: [card("a", 1), card("b", 2)],
      p1: [],
    });
    const result = splitPool(state, "deck", ["p1"], (c) =>
      c.value === 1 ? "p1" : "p2",
    );
    expect(result.pools.p1).toEqual([card("a", 1)]);
    expect(result.pools.deck).toEqual([card("b", 2)]);
  });

  it("does not mutate the original state", () => {
    const state = makeState({
      deck: [card("a", 1), card("b", 2)],
      p1: [],
    });
    splitPool(state, "deck", ["p1"], (c) => (c.value === 1 ? "p1" : null));
    expect(state.pools.deck).toEqual([card("a", 1), card("b", 2)]);
    expect(state.pools.p1).toEqual([]);
  });

  it("throws if source pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => splitPool(state, "nope", ["hand"], () => "hand")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});

describe("swapCards", () => {
  it("exchanges cards between two pools at their original positions", () => {
    const state = makeState({
      hand: [card("a"), card("b"), card("c")],
      discard: [card("x"), card("y")],
    });
    const result = swapCards(state, "hand", "b", "discard", "y");
    expect(result.pools.hand).toEqual([card("a"), card("y"), card("c")]);
    expect(result.pools.discard).toEqual([card("x"), card("b")]);
  });

  it("returns state unchanged if first card not found", () => {
    const state = makeState({
      hand: [card("a")],
      discard: [card("x")],
    });
    const result = swapCards(state, "hand", "z", "discard", "x");
    expect(result).toBe(state);
  });

  it("returns state unchanged if second card not found", () => {
    const state = makeState({
      hand: [card("a")],
      discard: [card("x")],
    });
    const result = swapCards(state, "hand", "a", "discard", "z");
    expect(result).toBe(state);
  });

  it("does not mutate the original state", () => {
    const state = makeState({
      hand: [card("a")],
      discard: [card("x")],
    });
    swapCards(state, "hand", "a", "discard", "x");
    expect(state.pools.hand).toEqual([card("a")]);
    expect(state.pools.discard).toEqual([card("x")]);
  });

  it("throws if pool does not exist", () => {
    const state = { pools: {} } as GenericCardGameState<string, TestCard>;
    expect(() => swapCards(state, "nope", "a", "hand", "b")).toThrow(
      'Pool "nope" does not exist',
    );
  });
});
