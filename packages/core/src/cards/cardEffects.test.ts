import { describe, expect, it } from "vitest";
import type {
  GenericCardGameState,
  GenericCardInstance,
} from "./genericCardGame";
import {
  type CardEffect,
  type EffectCard,
  type EffectContext,
  type EffectHandlerMap,
  type TransferCardsEffect,
  type ShufflePoolEffect,
  type BuiltinEffect,
  resolveEffects,
  createBuiltinEffectHandlers,
} from "./cardEffects";

// --- helpers ---

type TestEffect =
  | { type: "addPoints"; points: number }
  | { type: "setFlag"; flag: string };

interface TestCard extends EffectCard<TestEffect> {
  value: number;
}

interface TestState {
  score: number;
  flags: string[];
}

interface TestContext extends EffectContext<TestCard> {
  playerId: string;
}

function makeCard(
  id: string,
  value: number,
  effects: TestEffect[] = [],
): TestCard {
  return { id, value, effects };
}

const testHandlers: EffectHandlerMap<TestState, TestEffect, TestContext> = {
  addPoints: (state, effect) => ({
    ...state,
    score: state.score + effect.points,
  }),
  setFlag: (state, effect) => ({
    ...state,
    flags: [...state.flags, effect.flag],
  }),
};

// --- resolveEffects ---

describe("resolveEffects", () => {
  it("applies effects left to right", () => {
    const card = makeCard("c1", 5, [
      { type: "addPoints", points: 10 },
      { type: "setFlag", flag: "bonus" },
      { type: "addPoints", points: 5 },
    ]);
    const state: TestState = { score: 0, flags: [] };
    const ctx: TestContext = { card, playerId: "p1" };

    const result = resolveEffects(state, card.effects, testHandlers, ctx);

    expect(result.score).toBe(15);
    expect(result.flags).toEqual(["bonus"]);
  });

  it("returns state unchanged when effects array is empty", () => {
    const card = makeCard("c1", 1);
    const state: TestState = { score: 42, flags: ["existing"] };
    const ctx: TestContext = { card, playerId: "p1" };

    const result = resolveEffects(state, [], testHandlers, ctx);

    expect(result).toBe(state);
  });

  it("passes context to handlers", () => {
    type CtxEffect = { type: "greet" };
    interface CtxState {
      message: string;
    }

    const card = makeCard("c1", 1, []);
    const ctx: TestContext = { card, playerId: "p1" };

    const handlers: EffectHandlerMap<CtxState, CtxEffect, TestContext> = {
      greet: (state, _effect, context) => ({
        ...state,
        message: `hello ${context.playerId}`,
      }),
    };

    const result = resolveEffects(
      { message: "" },
      [{ type: "greet" as const }],
      handlers,
      ctx,
    );

    expect(result.message).toBe("hello p1");
  });

  it("throws when no handler is registered for an effect type", () => {
    const card = makeCard("c1", 1);
    const state: TestState = { score: 0, flags: [] };
    const ctx: TestContext = { card, playerId: "p1" };

    const incompleteHandlers = {
      addPoints: testHandlers.addPoints,
    } as EffectHandlerMap<TestState, TestEffect, TestContext>;

    expect(() =>
      resolveEffects(
        state,
        [{ type: "setFlag", flag: "x" }],
        incompleteHandlers,
        ctx,
      ),
    ).toThrow('No handler registered for effect type "setFlag"');
  });

  it("each handler receives the state from the previous handler", () => {
    const card = makeCard("c1", 1, [
      { type: "addPoints", points: 1 },
      { type: "addPoints", points: 2 },
      { type: "addPoints", points: 3 },
    ]);
    const state: TestState = { score: 100, flags: [] };
    const ctx: TestContext = { card, playerId: "p1" };

    const result = resolveEffects(state, card.effects, testHandlers, ctx);

    expect(result.score).toBe(106);
  });
});

// --- built-in effects ---

type PoolId = "deck" | "hand" | "discard";

interface PoolCard extends EffectCard<BuiltinEffect> {
  label: string;
}

type PoolState = GenericCardGameState<PoolId, PoolCard>;

function poolCard(
  id: string,
  label: string,
  effects: BuiltinEffect[] = [],
): PoolCard {
  return { id, label, effects };
}

function makePoolState(
  pools: Partial<Record<PoolId, PoolCard[]>>,
): PoolState {
  return {
    pools: {
      deck: [],
      hand: [],
      discard: [],
      ...pools,
    },
  };
}

describe("createBuiltinEffectHandlers", () => {
  const builtinHandlers = createBuiltinEffectHandlers<PoolState>();

  describe("transferCards", () => {
    it("moves cards between pools", () => {
      const state = makePoolState({
        deck: [poolCard("a", "A"), poolCard("b", "B"), poolCard("c", "C")],
        hand: [],
      });
      const card = poolCard("trigger", "T");
      const ctx: EffectContext<PoolCard> = { card };

      const effect: TransferCardsEffect = {
        type: "transferCards",
        count: 2,
        fromPool: "deck",
        toPool: "hand",
      };

      const result = resolveEffects(state, [effect], builtinHandlers, ctx);

      expect(result.pools.hand).toHaveLength(2);
      expect(result.pools.deck).toHaveLength(1);
    });

    it("transfers all cards when count is 'all'", () => {
      const state = makePoolState({
        deck: [poolCard("a", "A"), poolCard("b", "B"), poolCard("c", "C")],
        discard: [poolCard("x", "X")],
      });
      const card = poolCard("trigger", "T");
      const ctx: EffectContext<PoolCard> = { card };

      const effect: TransferCardsEffect = {
        type: "transferCards",
        count: "all",
        fromPool: "deck",
        toPool: "discard",
      };

      const result = resolveEffects(state, [effect], builtinHandlers, ctx);

      expect(result.pools.deck).toHaveLength(0);
      expect(result.pools.discard).toHaveLength(4);
    });

    it("returns state unchanged when count is 'all' and source pool is empty", () => {
      const state = makePoolState({
        deck: [],
        hand: [poolCard("x", "X")],
      });
      const card = poolCard("trigger", "T");
      const ctx: EffectContext<PoolCard> = { card };

      const effect: TransferCardsEffect = {
        type: "transferCards",
        count: "all",
        fromPool: "deck",
        toPool: "hand",
      };

      const result = resolveEffects(state, [effect], builtinHandlers, ctx);

      expect(result).toBe(state);
    });

    it("respects toPosition parameter", () => {
      const state = makePoolState({
        deck: [poolCard("a", "A")],
        hand: [poolCard("x", "X")],
      });
      const card = poolCard("trigger", "T");
      const ctx: EffectContext<PoolCard> = { card };

      const effect: TransferCardsEffect = {
        type: "transferCards",
        count: 1,
        fromPool: "deck",
        toPool: "hand",
        toPosition: "top",
      };

      const result = resolveEffects(state, [effect], builtinHandlers, ctx);

      expect(result.pools.hand[0].id).toBe("a");
      expect(result.pools.hand[1].id).toBe("x");
    });
  });

  describe("shufflePool", () => {
    it("shuffles the specified pool", () => {
      // Use a large enough pool that a shuffle is very likely to change order
      const cards = Array.from({ length: 20 }, (_, i) =>
        poolCard(`c${i}`, `Card ${i}`),
      );
      const state = makePoolState({ deck: cards });
      const card = poolCard("trigger", "T");
      const ctx: EffectContext<PoolCard> = { card };

      const effect: ShufflePoolEffect = {
        type: "shufflePool",
        pool: "deck",
      };

      const result = resolveEffects(state, [effect], builtinHandlers, ctx);

      // Same cards, just (very likely) different order
      expect(result.pools.deck).toHaveLength(20);
      const ids = result.pools.deck.map((c) => c.id).sort();
      const originalIds = cards.map((c) => c.id).sort();
      expect(ids).toEqual(originalIds);
    });
  });

  it("can be spread into a custom handler map", () => {
    type CustomEffect =
      | BuiltinEffect
      | { type: "gainLife"; amount: number };

    interface CustomState extends GenericCardGameState<PoolId, PoolCard> {
      life: number;
    }

    const state: CustomState = {
      pools: {
        deck: [poolCard("a", "A"), poolCard("b", "B")],
        hand: [],
        discard: [],
      },
      life: 10,
    };

    const handlers: EffectHandlerMap<
      CustomState,
      CustomEffect,
      EffectContext<PoolCard>
    > = {
      ...createBuiltinEffectHandlers<CustomState, EffectContext<PoolCard>>(),
      gainLife: (s, effect) => ({ ...s, life: s.life + effect.amount }),
    };

    const card = poolCard("trigger", "T");
    const effects: CustomEffect[] = [
      { type: "transferCards", count: 1, fromPool: "deck", toPool: "hand" },
      { type: "gainLife", amount: 5 },
    ];

    const result = resolveEffects(state, effects, handlers, { card });

    expect(result.pools.hand).toHaveLength(1);
    expect(result.pools.deck).toHaveLength(1);
    expect(result.life).toBe(15);
  });
});
