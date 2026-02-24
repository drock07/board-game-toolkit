import type { StateMachineConfig } from "@drock07/board-game-toolkit-core";

// --- Constants ---

export const SCORE_INDEX = {
  aces: 0,
  twos: 1,
  threes: 2,
  fours: 3,
  fives: 4,
  sixes: 5,
  threeOfAKind: 6,
  fourOfAKind: 7,
  fullHouse: 8,
  smallStraight: 9,
  largeStraight: 10,
  YAHTZEE: 11,
  chance: 12,
  yahtzeeBonuses: 13,
} as const;

// --- Types ---

export type DieRoll = 1 | 2 | 3 | 4 | 5 | 6;
export type YahtzeeDice = [DieRoll, DieRoll, DieRoll, DieRoll, DieRoll];
export type HeldDice = [boolean, boolean, boolean, boolean, boolean];
export type ScoreIndex = (typeof SCORE_INDEX)[keyof typeof SCORE_INDEX];

export interface YahtzeeScoreSummary {
  upperSubtotal: number;
  upperBonus: number;
  upperTotal: number;
  lowerTotal: number;
  grandTotal: number;
}

export interface YahtzeeState {
  dice: YahtzeeDice | null;
  heldDice: HeldDice;
  roll: number;
  score: (number | undefined)[];
}

export type YahtzeeCommand =
  | { type: "roll" }
  | { type: "toggleHold"; index: number }
  | { type: "score"; index: ScoreIndex };

// --- Initial State ---

export const initialState: YahtzeeState = {
  dice: null,
  roll: 1,
  heldDice: [false, false, false, false, false],
  score: Array(14).fill(undefined),
};

// --- State Machine Config ---

export const yahtzeeConfig: StateMachineConfig<YahtzeeState, YahtzeeCommand> = {
  id: "yahtzee",
  initial: "setup",
  states: {
    setup: {
      onExit: (state) => ({
        ...state,
        dice: [rollDice(), rollDice(), rollDice(), rollDice(), rollDice()],
        roll: 1,
        heldDice: [false, false, false, false, false],
      }),
      getNext: () => "roll",
    },
    roll: {
      onExit: (state) => ({
        ...state,
        roll: state.roll + 1,
      }),
      actions: {
        roll: {
          execute: (state) => {
            return {
              ...state,
              dice: state.heldDice.map((isHeld, i) =>
                isHeld && state.dice ? state.dice[i] : rollDice(),
              ) as YahtzeeDice,
            };
          },
        },
        toggleHold: {
          execute: (state, { index }) => ({
            ...state,
            heldDice: state.heldDice.map((isHeld, i) =>
              i === index ? !isHeld : isHeld,
            ) as HeldDice,
          }),
        },
      },
      getNext: (state) => {
        if (state.roll >= 3) return "scoreTurn";
        return "roll";
      },
    },
    scoreTurn: {
      onEnter: (state) => {
        if (
          state.dice &&
          hasNOfAKind(state.dice, 5) &&
          state.score[SCORE_INDEX.YAHTZEE] !== undefined &&
          state.score[SCORE_INDEX.YAHTZEE] !== 0
        ) {
          const newScore = [...state.score];
          newScore[SCORE_INDEX.yahtzeeBonuses] =
            (newScore[SCORE_INDEX.yahtzeeBonuses] ?? 0) + 100;
          return {
            ...state,
            score: newScore,
          };
        }
        return state;
      },
      actions: {
        score: {
          validate: (state, { index }) => {
            return state.score[index] === undefined;
          },
          execute: (state, { index }) => {
            const dice = state.dice!;
            const score = [...state.score];
            switch (index) {
              case 0: // aces
                score[index] = dice.filter((d) => d === 1).length;
                break;
              case 1: // twos
                score[index] = dice.filter((d) => d === 2).length * 2;
                break;
              case 2: // threes
                score[index] = dice.filter((d) => d === 3).length * 3;
                break;
              case 3: // fours
                score[index] = dice.filter((d) => d === 4).length * 4;
                break;
              case 4: // fives
                score[index] = dice.filter((d) => d === 5).length * 5;
                break;
              case 5: // sixes
                score[index] = dice.filter((d) => d === 6).length * 6;
                break;
              case 6: // three of a kind
                score[index] = hasNOfAKind(dice, 3) ? dice.reduce(sum, 0) : 0;
                break;
              case 7: // four of a kind
                score[index] = hasNOfAKind(dice, 4) ? dice.reduce(sum, 0) : 0;
                break;
              case 8: // full house
                score[index] = isFullHouse(dice) ? 25 : 0;
                break;
              case 9: // sm straight
                score[index] = longestRun(dice) >= 4 ? 30 : 0;
                break;
              case 10: // lg straight
                score[index] = longestRun(dice) >= 5 ? 40 : 0;
                break;
              case 11: // YAHTZEE
                score[index] = hasNOfAKind(dice, 5) ? 50 : 0;
                break;
              case 12: // chance
                score[index] = dice.reduce(sum, 0);
                break;
            }
            return { ...state, score };
          },
        },
      },
      getNext: (state) => {
        if (state.score.every((v) => v !== undefined)) return "gameOver";
        return "setup";
      },
    },
    gameOver: {
      onExit: (state) => ({
        ...state,
        dice: null,
        heldDice: [false, false, false, false, false],
        roll: 1,
        score: Array(14).fill(undefined),
      }),
      getNext: () => "setup",
    },
  },
};

function sum(s: number, d: DieRoll): number {
  return s + d;
}

function hasNOfAKind(dice: YahtzeeDice, n: number): boolean {
  const counts = new Map<number, number>();
  for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts.values()].some((c) => c >= n);
}

function isFullHouse(dice: YahtzeeDice): boolean {
  const counts = new Map<number, number>();
  for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
  const values = [...counts.values()].sort();
  return values.length === 2 && values[0] === 2 && values[1] === 3;
}

function longestRun(dice: YahtzeeDice): number {
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let longest = 1;
  let current = 1;
  for (let i = 1; i < unique.length; i++) {
    current = unique[i] === unique[i - 1] + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function rollDice(): DieRoll {
  return [1, 2, 3, 4, 5, 6][Math.floor(Math.random() * 6)] as DieRoll;
}

export function computeScoreSummary(
  score: YahtzeeState["score"],
): YahtzeeScoreSummary {
  const upperSubtotal = score
    .slice(0, 6)
    .reduce<number>((sum, val) => sum + (val ?? 0), 0);
  const upperBonus = upperSubtotal >= 63 ? 35 : 0;
  const upperTotal = upperSubtotal + upperBonus;
  const lowerTotal = score
    .slice(6, 14)
    .reduce<number>((sum, val) => sum + (val ?? 0), 0);
  return {
    upperSubtotal,
    upperBonus,
    upperTotal,
    lowerTotal,
    grandTotal: upperTotal + lowerTotal,
  };
}
