import {
  apply,
  init,
  type ApplyResult,
  type Game,
  type InitOptions,
} from "../game.js";
import type { Json } from "../json.js";
import { cyrb128 } from "../rng.js";
import type { GameState, GameTypes, Input, Prompt } from "../types.js";

export { checkInvariants } from "../invariants.js";
export { createGameState } from "../state.js";
export type { CreateStateOptions } from "../state.js";
export { openTx, transact } from "../tx.js";
export type { OpenTx, TxOptions, TxResult } from "../tx.js";

/** JSON with object keys sorted, so equal states stringify equally. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return v;
  });
}

/** A short, stable hash of a state, for golden replay fixtures. */
export function hashState<T extends GameTypes>(state: GameState<T>): string {
  return cyrb128(stableStringify(state))
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
}

export interface SimulateOptions extends InitOptions {
  inputs: Input[];
}

/** Applies inputs in order and returns every result, starting with `init`'s. Throws on a rejected input. */
export function simulate<T extends GameTypes>(
  game: Game<T>,
  opts: SimulateOptions,
): ApplyResult<T>[] {
  const results = [init(game, opts)];
  opts.inputs.forEach((input, i) => {
    const res = apply(game, results.at(-1)!.state, input);
    if (!res.ok) {
      throw new Error(
        `Input ${i} was rejected: ${res.error.code}: ${res.error.message}`,
      );
    }
    results.push(res);
  });
  return results;
}

/** A recorded game: replaying its inputs from its seed must reach the same state. */
export interface GoldenReplay {
  players: string[];
  seed: string;
  options?: Json;
  inputs: Input[];
  finalStateHash: string;
}

/**
 * Plays a game by asking `choose` for each input until it returns undefined
 * or `maxInputs` is reached, and records it as a golden replay.
 */
export function record<T extends GameTypes>(
  game: Game<T>,
  opts: InitOptions & { maxInputs: number },
  choose: (result: ApplyResult<T>, step: number) => Input | undefined,
): { golden: GoldenReplay; results: ApplyResult<T>[] } {
  const results = [init(game, opts)];
  const inputs: Input[] = [];
  for (let i = 0; i < opts.maxInputs; i++) {
    const last = results.at(-1)!;
    if (last.state.status === "finished") break;
    const input = choose(last, i);
    if (!input) break;
    const res = apply(game, last.state, input);
    if (!res.ok) {
      throw new Error(
        `Input ${i} was rejected: ${res.error.code}: ${res.error.message}`,
      );
    }
    inputs.push(input);
    results.push(res);
  }
  const golden: GoldenReplay = {
    players: opts.players,
    seed: opts.seed,
    inputs,
    finalStateHash: hashState(results.at(-1)!.state),
  };
  if (opts.options !== undefined) golden.options = opts.options;
  return { golden, results };
}

/** Throws unless the result has exactly one open prompt matching `expected`. */
export function expectPrompt(
  result: { prompts: Prompt[] },
  expected: Partial<Prompt>,
): Prompt {
  const [prompt, ...rest] = result.prompts;
  if (!prompt || rest.length) {
    throw new Error(`Expected one open prompt, found ${result.prompts.length}`);
  }
  for (const [k, v] of Object.entries(expected)) {
    const actual = prompt[k as keyof Prompt];
    if (stableStringify(actual) !== stableStringify(v)) {
      throw new Error(
        `Prompt ${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
  return prompt;
}
