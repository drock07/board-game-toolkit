import { draw, shuffle } from "./deck";

/**
 * Base interface for a card instance. Extend this to add game-specific
 * properties like suit, rank, cost, etc.
 *
 * @example
 * ```ts
 * interface MyCard extends GenericCardInstance {
 *   suit: "hearts" | "diamonds" | "clubs" | "spades";
 *   rank: number;
 * }
 * ```
 */
export interface GenericCardInstance<TInstanceId = string> {
  id: TInstanceId;
}

/**
 * State container for a card game. Pools are named, ordered collections
 * of cards (e.g. "deck", "hand", "discard").
 *
 * @typeParam TPoolId - Union of valid pool names. Defaults to `string` for quick prototyping.
 * @typeParam TCard - The card type stored in pools.
 *
 * @example
 * ```ts
 * type MyState = GenericCardGameState<"deck" | "hand" | "discard", MyCard>;
 * ```
 */
export interface GenericCardGameState<
  TPoolId extends string = string,
  TCard extends GenericCardInstance = GenericCardInstance,
> {
  pools: { [K in TPoolId]: TCard[] };
}

/** Extracts the pool ID union type from a state type. */
export type PoolIdOf<TState extends GenericCardGameState> = string &
  keyof TState["pools"];

/** Extracts the card type from a state type. */
export type CardOf<TState extends GenericCardGameState> =
  TState["pools"][PoolIdOf<TState>][number];

function assertPoolExists<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
): void {
  if (!(poolId in state.pools)) {
    throw new Error(`Pool "${poolId}" does not exist`);
  }
}

/**
 * Removes a card from a pool by its ID. Returns the state unchanged
 * if the card is not found in the pool.
 *
 * @throws If the pool does not exist.
 */
export function removeFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  cardId: CardOf<TState>["id"],
): TState {
  assertPoolExists(state, poolId);
  const pool = [...state.pools[poolId]];
  const cardIndex = pool.findIndex((c) => c.id === cardId);
  if (cardIndex < 0) return state;
  pool.splice(cardIndex, 1);

  return {
    ...state,
    pools: {
      ...state.pools,
      [poolId]: pool,
    },
  };
}

/**
 * Adds one or more cards to a pool at the specified position.
 *
 * @param position - Where to insert the cards:
 *   - `"bottom"` (default) — appends to the end of the pool.
 *   - `"top"` — prepends to the beginning of the pool.
 *   - `"random"` — inserts each card at a random position.
 *   - `number` — inserts at the given index.
 *
 * @throws If the pool does not exist.
 */
export function addToPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  cards: CardOf<TState> | CardOf<TState>[],
  position: "bottom" | "top" | "random" | number = "bottom",
): TState {
  assertPoolExists(state, poolId);
  const pool = [...state.pools[poolId]];
  const cardsToAdd = Array.isArray(cards) ? cards : [cards];

  if (typeof position === "number") {
    pool.splice(position, 0, ...cardsToAdd);
  } else if (position === "bottom") {
    pool.push(...cardsToAdd);
  } else if (position === "top") {
    pool.unshift(...cardsToAdd);
  } else {
    for (const card of cardsToAdd) {
      const index = Math.floor(Math.random() * (pool.length + 1));
      pool.splice(index, 0, card);
    }
  }
  return {
    ...state,
    pools: {
      ...state.pools,
      [poolId]: pool,
    },
  };
}

/**
 * Draws cards from the front of a pool. Returns a tuple of the drawn
 * card(s) and the updated state.
 *
 * When called without a count, draws a single card and returns `[card, state]`.
 * When called with a count, draws multiple cards and returns `[cards[], state]`.
 *
 * Optionally accepts a `reshufflePoolId` — if the draw pool doesn't have
 * enough cards, the reshuffle pool is shuffled back in automatically and
 * emptied in the returned state.
 *
 * @throws If the pool (or reshuffle pool) does not exist.
 * @throws If there are not enough cards to draw.
 */
export function drawFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
): [CardOf<TState>, TState];
export function drawFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  reshufflePoolId: PoolIdOf<TState>,
): [CardOf<TState>, TState];
export function drawFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  count: number,
): [CardOf<TState>[], TState];
export function drawFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  count: number,
  reshufflePoolId: PoolIdOf<TState>,
): [CardOf<TState>[], TState];
export function drawFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  count?: number | PoolIdOf<TState>,
  reshufflePoolId?: PoolIdOf<TState>,
): [CardOf<TState>, TState] | [CardOf<TState>[], TState] {
  assertPoolExists(state, poolId);

  const numCount = typeof count === "number" ? count : 1;
  const reshuffleId =
    typeof count === "string" ? (count as PoolIdOf<TState>) : reshufflePoolId;

  if (reshuffleId) {
    assertPoolExists(state, reshuffleId);
  }

  const pool = state.pools[poolId];
  const reshufflePool = reshuffleId ? state.pools[reshuffleId] : undefined;

  type TCard = CardOf<TState>;
  let drawn: TCard[];
  let remaining: TCard[];
  let updatedPools = { ...state.pools };

  if (reshufflePool) {
    const [d, r, leftover] = draw(pool, numCount, reshufflePool);
    drawn = (Array.isArray(d) ? d : [d]) as TCard[];
    remaining = r as TCard[];
    updatedPools[reshuffleId!] = leftover as TCard[];
  } else {
    const [d, r] = draw(pool, numCount);
    drawn = (Array.isArray(d) ? d : [d]) as TCard[];
    remaining = r as TCard[];
  }

  updatedPools[poolId] = remaining;

  const newState: TState = { ...state, pools: updatedPools };

  if (typeof count !== "number") {
    return [drawn[0], newState];
  }
  return [drawn, newState];
}

/**
 * Randomizes the order of cards in a pool using Fisher-Yates shuffle.
 *
 * @throws If the pool does not exist.
 */
export function shufflePool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
): TState {
  assertPoolExists(state, poolId);
  return {
    ...state,
    pools: {
      ...state.pools,
      [poolId]: shuffle(state.pools[poolId]),
    },
  };
}

/**
 * Moves a specific card from one pool to another by its ID. Returns the
 * state unchanged if the card is not found in the source pool.
 *
 * @param position - Where to insert the card in the destination pool.
 *   See {@link addToPool} for position options.
 *
 * @throws If either pool does not exist.
 */
export function moveCard<TState extends GenericCardGameState>(
  state: TState,
  fromPoolId: PoolIdOf<TState>,
  toPoolId: PoolIdOf<TState>,
  cardId: CardOf<TState>["id"],
  position: "bottom" | "top" | "random" | number = "bottom",
): TState {
  assertPoolExists(state, fromPoolId);
  assertPoolExists(state, toPoolId);
  const card = state.pools[fromPoolId].find((c) => c.id === cardId);
  if (!card) return state;

  const afterRemove = removeFromPool(state, fromPoolId, cardId);
  return addToPool(afterRemove, toPoolId, card, position);
}

/**
 * Draws cards from one pool and adds them to another in a single operation.
 * Equivalent to calling {@link drawFromPool} followed by {@link addToPool}.
 *
 * @param count - Number of cards to draw. Defaults to 1.
 * @param position - Where to insert the drawn cards in the destination pool.
 *   See {@link addToPool} for position options.
 *
 * @throws If either pool does not exist.
 * @throws If there are not enough cards to draw.
 */
export function drawToPool<TState extends GenericCardGameState>(
  state: TState,
  fromPoolId: PoolIdOf<TState>,
  toPoolId: PoolIdOf<TState>,
  count?: number,
  position: "bottom" | "top" | "random" | number = "bottom",
): TState {
  const numCount = count ?? 1;
  const [drawn, newState] = drawFromPool(state, fromPoolId, numCount);
  return addToPool(newState, toPoolId, drawn as CardOf<TState>[], position);
}

/**
 * Returns all cards in a pool that match the predicate. Does not modify state.
 *
 * @throws If the pool does not exist.
 */
export function findInPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  predicate: (card: CardOf<TState>) => boolean,
): CardOf<TState>[] {
  assertPoolExists(state, poolId);
  return state.pools[poolId].filter(predicate);
}

/**
 * Deals cards from a source pool to multiple target pools in round-robin
 * order, one card at a time — just like dealing at a real table.
 *
 * @param countPerTarget - Number of cards to deal to each target pool.
 * @param position - Where to insert dealt cards in each target pool.
 *   See {@link addToPool} for position options.
 *
 * @throws If the source pool or any target pool does not exist.
 * @throws If there are not enough cards to complete the deal.
 */
export function dealFromPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  targetPoolIds: PoolIdOf<TState>[],
  countPerTarget: number,
  position: "bottom" | "top" | "random" | number = "bottom",
): TState {
  assertPoolExists(state, poolId);
  for (const targetId of targetPoolIds) {
    assertPoolExists(state, targetId);
  }

  const totalNeeded = targetPoolIds.length * countPerTarget;
  const [drawn, newState] = drawFromPool(state, poolId, totalNeeded);
  const drawnCards = drawn as CardOf<TState>[];

  let result = newState;
  for (let round = 0; round < countPerTarget; round++) {
    for (let t = 0; t < targetPoolIds.length; t++) {
      const cardIndex = round * targetPoolIds.length + t;
      result = addToPool(
        result,
        targetPoolIds[t],
        drawnCards[cardIndex],
        position,
      );
    }
  }

  return result;
}

/**
 * Returns the top N cards from a pool without removing them. Does not
 * modify state.
 *
 * @param count - Number of cards to peek at. Defaults to 1.
 *
 * @throws If the pool does not exist.
 */
export function peekPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  count: number = 1,
): CardOf<TState>[] {
  assertPoolExists(state, poolId);
  return state.pools[poolId].slice(0, count);
}

/**
 * Sorts the cards in a pool using the provided comparison function.
 *
 * @param compareFn - Standard comparator: return negative if `a` should
 *   come before `b`, positive if after, zero if equal.
 *
 * @throws If the pool does not exist.
 */
export function sortPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  compareFn: (a: CardOf<TState>, b: CardOf<TState>) => number,
): TState {
  assertPoolExists(state, poolId);
  return {
    ...state,
    pools: {
      ...state.pools,
      [poolId]: [...state.pools[poolId]].sort(compareFn),
    },
  };
}

/**
 * Counts the cards in a pool, optionally filtered by a predicate.
 * Returns the total count if no predicate is provided.
 *
 * @throws If the pool does not exist.
 */
export function countInPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  predicate?: (card: CardOf<TState>) => boolean,
): number {
  assertPoolExists(state, poolId);
  const pool = state.pools[poolId];
  if (!predicate) return pool.length;
  return pool.filter(predicate).length;
}

/**
 * Partitions a pool's cards into multiple target pools using a classifier
 * function. The source pool is emptied. Cards whose classifier returns
 * a pool ID not in `targetPoolIds` remain in the source pool.
 *
 * @param assignFn - Given a card, returns the target pool ID it should
 *   be assigned to, or `null`/`undefined` to keep it in the source pool.
 * @param position - Where to insert cards in each target pool.
 *   See {@link addToPool} for position options.
 *
 * @throws If the source pool or any target pool does not exist.
 */
export function splitPool<TState extends GenericCardGameState>(
  state: TState,
  poolId: PoolIdOf<TState>,
  targetPoolIds: PoolIdOf<TState>[],
  assignFn: (card: CardOf<TState>) => PoolIdOf<TState> | null | undefined,
  position: "bottom" | "top" | "random" | number = "bottom",
): TState {
  assertPoolExists(state, poolId);
  for (const targetId of targetPoolIds) {
    assertPoolExists(state, targetId);
  }

  type TPoolId = PoolIdOf<TState>;
  type TCard = CardOf<TState>;

  const targetSet = new Set<string>(targetPoolIds);
  const buckets = new Map<TPoolId, TCard[]>();
  const remaining: TCard[] = [];

  for (const card of state.pools[poolId]) {
    const target = assignFn(card);
    if (target != null && targetSet.has(target)) {
      const bucket = buckets.get(target) ?? [];
      bucket.push(card);
      buckets.set(target, bucket);
    } else {
      remaining.push(card);
    }
  }

  let result: TState = {
    ...state,
    pools: {
      ...state.pools,
      [poolId]: remaining,
    },
  };

  for (const [targetId, cards] of buckets) {
    result = addToPool(result, targetId, cards, position);
  }

  return result;
}

/**
 * Exchanges a card from one pool with a card from another. Both cards
 * end up in the position the other occupied. Returns the state unchanged
 * if either card is not found in its respective pool.
 *
 * @throws If either pool does not exist.
 */
export function swapCards<TState extends GenericCardGameState>(
  state: TState,
  poolIdA: PoolIdOf<TState>,
  cardIdA: CardOf<TState>["id"],
  poolIdB: PoolIdOf<TState>,
  cardIdB: CardOf<TState>["id"],
): TState {
  assertPoolExists(state, poolIdA);
  assertPoolExists(state, poolIdB);

  const poolA = [...state.pools[poolIdA]];
  const poolB = [...state.pools[poolIdB]];

  const indexA = poolA.findIndex((c) => c.id === cardIdA);
  const indexB = poolB.findIndex((c) => c.id === cardIdB);
  if (indexA < 0 || indexB < 0) return state;

  const cardA = poolA[indexA];
  const cardB = poolB[indexB];

  poolA[indexA] = cardB;
  poolB[indexB] = cardA;

  return {
    ...state,
    pools: {
      ...state.pools,
      [poolIdA]: poolA,
      [poolIdB]: poolB,
    },
  };
}
