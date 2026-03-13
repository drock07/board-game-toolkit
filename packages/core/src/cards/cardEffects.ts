import type { GenericCardInstance, GenericCardGameState, PoolIdOf } from "./genericCardGame";
import { drawToPool, shufflePool } from "./genericCardGame";

// ---------------------------------------------------------------------------
// Core effect types
// ---------------------------------------------------------------------------

/**
 * Base interface for a card effect. Extend this with a discriminated union
 * to define your game's effects.
 *
 * @example
 * ```ts
 * type MyEffect =
 *   | { type: "drawCards"; count: number }
 *   | { type: "skipNextPlayer" }
 *   | { type: "reverseDirection" };
 * ```
 */
export interface CardEffect {
  type: string;
}

/**
 * A card that carries effects. Extend this alongside {@link CardEffect}
 * to define cards with game-specific properties and effects.
 *
 * @example
 * ```ts
 * interface SpellCard extends EffectCard<MyEffect> {
 *   manaCost: number;
 *   element: "fire" | "ice" | "lightning";
 * }
 * ```
 */
export interface EffectCard<TEffect extends CardEffect = CardEffect>
  extends GenericCardInstance {
  effects: TEffect[];
}

/**
 * Context passed to effect handlers during resolution. Contains the card
 * that triggered the effects.
 *
 * Games can extend this with additional context (current player, target, etc.)
 * by passing a custom context type to {@link EffectHandler}.
 */
export interface EffectContext<TCard extends GenericCardInstance = GenericCardInstance> {
  card: TCard;
}

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

/**
 * A function that applies a single effect to the game state.
 *
 * @typeParam TState - The game state type.
 * @typeParam TEffect - The specific effect type this handler processes.
 * @typeParam TContext - The context type passed during resolution.
 */
export type EffectHandler<
  TState,
  TEffect extends CardEffect,
  TContext extends EffectContext = EffectContext,
> = (state: TState, effect: TEffect, context: TContext) => TState;

/**
 * A mapping from each effect's `type` string to its handler. Every effect
 * type in the union must have a corresponding handler.
 *
 * @example
 * ```ts
 * const handlers: EffectHandlerMap<MyState, MyEffect, MyContext> = {
 *   drawCards: (state, effect, ctx) => { ... },
 *   skipNextPlayer: (state, effect, ctx) => { ... },
 *   reverseDirection: (state, effect, ctx) => { ... },
 * };
 * ```
 */
export type EffectHandlerMap<
  TState,
  TEffect extends CardEffect,
  TContext extends EffectContext = EffectContext,
> = {
  [K in TEffect["type"]]: EffectHandler<
    TState,
    Extract<TEffect, { type: K }>,
    TContext
  >;
};

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves a list of effects by applying their handlers to the state
 * from left to right. Each handler receives the state returned by the
 * previous handler.
 *
 * @param state - The initial game state.
 * @param effects - The effects to resolve, in order.
 * @param handlers - A handler for each effect type.
 * @param context - Context passed to every handler.
 * @returns The state after all effects have been applied.
 *
 * @example
 * ```ts
 * const card = hand.find(c => c.id === cardId)!;
 * const newState = resolveEffects(
 *   state,
 *   card.effects,
 *   myHandlers,
 *   { card },
 * );
 * ```
 */
export function resolveEffects<
  TState,
  TEffect extends CardEffect,
  TContext extends EffectContext,
>(
  state: TState,
  effects: TEffect[],
  handlers: EffectHandlerMap<TState, TEffect, TContext>,
  context: TContext,
): TState {
  let current = state;
  for (const effect of effects) {
    const handler = handlers[effect.type as TEffect["type"]];
    if (!handler) {
      throw new Error(`No handler registered for effect type "${effect.type}"`);
    }
    current = (handler as EffectHandler<TState, TEffect, TContext>)(
      current,
      effect,
      context,
    );
  }
  return current;
}

// ---------------------------------------------------------------------------
// Built-in effects
// ---------------------------------------------------------------------------

/**
 * Draws cards from one pool and places them in another.
 * Useful for "draw 2", "opponent draws 4", "discard your entire hand", etc.
 *
 * @param count - Number of cards to transfer, or `"all"` to transfer
 *   every card in the source pool.
 */
export interface TransferCardsEffect extends CardEffect {
  type: "transferCards";
  count: number | "all";
  fromPool: string;
  toPool: string;
  toPosition?: "top" | "bottom" | "random";
}

/**
 * Shuffles a pool in place.
 */
export interface ShufflePoolEffect extends CardEffect {
  type: "shufflePool";
  pool: string;
}

/** Union of all built-in effects. */
export type BuiltinEffect = TransferCardsEffect | ShufflePoolEffect;

/**
 * Creates handlers for the built-in effects that operate on
 * {@link GenericCardGameState}. Spread these into your own handler map
 * to get pool operations for free.
 *
 * @example
 * ```ts
 * const handlers: EffectHandlerMap<MyState, MyEffect, MyContext> = {
 *   ...createBuiltinEffectHandlers<MyState, MyContext>(),
 *   myCustomEffect: (state, effect, ctx) => { ... },
 * };
 * ```
 */
export function createBuiltinEffectHandlers<
  TState extends GenericCardGameState,
  TContext extends EffectContext = EffectContext,
>(): EffectHandlerMap<TState, BuiltinEffect, TContext> {
  return {
    transferCards: (state, effect) => {
      const fromPool = effect.fromPool as PoolIdOf<TState>;
      const count =
        effect.count === "all"
          ? state.pools[fromPool].length
          : effect.count;
      if (count === 0) return state;
      return drawToPool(
        state,
        fromPool,
        effect.toPool as PoolIdOf<TState>,
        count,
        effect.toPosition ?? "bottom",
      );
    },
    shufflePool: (state, effect) => {
      return shufflePool(state, effect.pool as PoolIdOf<TState>);
    },
  };
}
