import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";
import { Cards } from "@drock07/board-game-toolkit-core";
import type {
  EffectCard,
  EffectContext,
  EffectHandlerMap,
  BuiltinEffect,
  TransferCardsEffect,
  GenericCardGameState,
} from "@drock07/board-game-toolkit-core";

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export type DealDamageEffect = { type: "dealDamage"; amount: number };
export type GainBlockEffect = { type: "gainBlock"; amount: number };

export type BattleEffect =
  | BuiltinEffect
  | DealDamageEffect
  | GainBlockEffect;

// ---------------------------------------------------------------------------
// Card type
// ---------------------------------------------------------------------------

export interface BattleCard extends EffectCard<BattleEffect> {
  name: string;
  cost: number;
  description: string;
}

let nextCardId = 0;

function createCard(
  name: string,
  cost: number,
  description: string,
  effects: BattleEffect[],
): BattleCard {
  return { id: `card-${nextCardId++}`, name, cost, description, effects };
}

export function createDeck(): BattleCard[] {
  return [
    // 5x Strike
    ...Array.from({ length: 5 }, () =>
      createCard("Strike", 1, "Deal 6 damage", [
        { type: "dealDamage", amount: 6 },
      ]),
    ),
    // 4x Defend
    ...Array.from({ length: 4 }, () =>
      createCard("Defend", 1, "Gain 5 block", [
        { type: "gainBlock", amount: 5 },
      ]),
    ),
    // 2x Bash
    ...Array.from({ length: 2 }, () =>
      createCard("Bash", 2, "Deal 8 damage, gain 2 block", [
        { type: "dealDamage", amount: 8 },
        { type: "gainBlock", amount: 2 },
      ]),
    ),
    // 1x Sprint
    createCard("Sprint", 1, "Draw 2 cards", [
      {
        type: "transferCards",
        count: 2,
        fromPool: "drawPile",
        toPool: "hand",
      } satisfies TransferCardsEffect,
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Pool & State
// ---------------------------------------------------------------------------

export type BattlePoolId = "drawPile" | "hand" | "discardPile";

export interface TowerBattlerState
  extends GenericCardGameState<BattlePoolId, BattleCard> {
  playerHp: number;
  playerMaxHp: number;
  playerBlock: number;
  energy: number;
  maxEnergy: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyIntent: number; // damage the enemy will deal this turn
  turn: number;
  selectedCardId: string | null;
  result: "win" | "lose" | null;
  message: string | null;
}

export type TowerBattlerCommand =
  | { type: "selectCard"; cardId: string }
  | { type: "playCard" }
  | { type: "endTurn" };

// ---------------------------------------------------------------------------
// Effect handlers
// ---------------------------------------------------------------------------

type BattleContext = EffectContext<BattleCard>;

const effectHandlers: EffectHandlerMap<
  TowerBattlerState,
  BattleEffect,
  BattleContext
> = {
  ...Cards.createBuiltinEffectHandlers<TowerBattlerState, BattleContext>(),
  dealDamage: (state, effect) => ({
    ...state,
    enemyHp: Math.max(0, state.enemyHp - effect.amount),
  }),
  gainBlock: (state, effect) => ({
    ...state,
    playerBlock: state.playerBlock + effect.amount,
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnemyIntent(turn: number): number {
  // Simple pattern: alternates between light and heavy attacks
  return turn % 3 === 0 ? 14 : 8;
}

function reshuffleDraw(state: TowerBattlerState): TowerBattlerState {
  if (state.pools.drawPile.length > 0) return state;
  if (state.pools.discardPile.length === 0) return state;
  let newState = Cards.addToPool(
    state,
    "drawPile",
    state.pools.discardPile,
  );
  newState = {
    ...newState,
    pools: { ...newState.pools, discardPile: [] },
  };
  return Cards.shufflePool(newState, "drawPile");
}

function drawCards(
  state: TowerBattlerState,
  count: number,
): TowerBattlerState {
  let current = state;
  for (let i = 0; i < count; i++) {
    current = reshuffleDraw(current);
    if (current.pools.drawPile.length === 0) break;
    current = Cards.drawToPool(current, "drawPile", "hand");
  }
  return current;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialState: TowerBattlerState = {
  pools: {
    drawPile: [],
    hand: [],
    discardPile: [],
  },
  playerHp: 50,
  playerMaxHp: 50,
  playerBlock: 0,
  energy: 3,
  maxEnergy: 3,
  enemyHp: 40,
  enemyMaxHp: 40,
  enemyIntent: 8,
  turn: 1,
  selectedCardId: null,
  result: null,
  message: null,
};

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export const towerBattlerConfig: StateMachineConfig<
  TowerBattlerState,
  TowerBattlerCommand
> = {
  id: "tower-battler",
  initial: "setup",
  states: {
    setup: {
      autoadvance: true,
      onEnter: () => {
        nextCardId = 0;
        const deck = Cards.shuffle(createDeck());
        const state: TowerBattlerState = {
          ...initialState,
          pools: { ...initialState.pools, drawPile: deck },
          enemyIntent: getEnemyIntent(1),
        };
        return drawCards(state, 5);
      },
      getNext: () => "playerTurn",
    },

    playerTurn: {
      onEnter: (state) => ({
        ...state,
        selectedCardId: null,
        message: null,
      }),
      actions: {
        selectCard: {
          validate: (state, cmd) =>
            state.pools.hand.some((c) => c.id === cmd.cardId),
          execute: (state, cmd) => ({
            ...state,
            selectedCardId:
              state.selectedCardId === cmd.cardId ? null : cmd.cardId,
          }),
        },
        playCard: {
          validate: (state) => {
            if (!state.selectedCardId) return false;
            const card = state.pools.hand.find(
              (c) => c.id === state.selectedCardId,
            );
            return !!card && card.cost <= state.energy;
          },
          execute: (state, _cmd, { transitionTo }) => {
            const card = state.pools.hand.find(
              (c) => c.id === state.selectedCardId,
            )!;

            // Move card to discard
            let newState = Cards.moveCard(
              state,
              "hand",
              "discardPile",
              card.id,
            );

            // Spend energy
            newState = {
              ...newState,
              energy: newState.energy - card.cost,
              selectedCardId: null,
            };

            // Resolve effects
            newState = Cards.resolveEffects(
              newState,
              card.effects,
              effectHandlers,
              { card },
            );

            // Check for enemy defeat
            if (newState.enemyHp <= 0) {
              return transitionTo("settle", newState);
            }

            return newState;
          },
        },
        endTurn: {
          execute: (state, _cmd, { transitionTo }) => {
            return transitionTo("enemyTurn", state);
          },
        },
      },
    },

    enemyTurn: {
      autoadvance: true,
      onEnter: (state) => {
        // Discard remaining hand
        let newState: TowerBattlerState = {
          ...state,
          pools: {
            ...state.pools,
            discardPile: [...state.pools.discardPile, ...state.pools.hand],
            hand: [],
          },
        };

        // Enemy attacks
        const damage = newState.enemyIntent;
        const blocked = Math.min(damage, newState.playerBlock);
        const remaining = damage - blocked;

        newState = {
          ...newState,
          playerHp: Math.max(0, newState.playerHp - remaining),
          playerBlock: 0,
          message: remaining > 0
            ? `Enemy deals ${remaining} damage${blocked > 0 ? ` (${blocked} blocked)` : ""}!`
            : `Blocked all ${damage} damage!`,
        };

        return newState;
      },
      getNext: (state) => {
        if (state.playerHp <= 0) return "settle";
        return "drawPhase";
      },
    },

    drawPhase: {
      autoadvance: true,
      onEnter: (state) => {
        const nextTurn = state.turn + 1;
        let newState: TowerBattlerState = {
          ...state,
          energy: state.maxEnergy,
          playerBlock: 0,
          turn: nextTurn,
          enemyIntent: getEnemyIntent(nextTurn),
        };
        return drawCards(newState, 5);
      },
      getNext: () => "playerTurn",
    },

    settle: {
      onEnter: (state) => {
        const won = state.enemyHp <= 0;
        return {
          ...state,
          result: won ? "win" : "lose",
          message: won ? "Victory!" : "Defeated...",
        };
      },
      getNext: () => "setup",
    },
  },
};
