import type { Bot } from "../bots.js";
import {
  apply,
  init,
  legalInputs,
  replay,
  type ApplyResult,
  type Game,
} from "../game.js";
import { checkInvariants } from "../invariants.js";
import { jsonEqual, type Json } from "../json.js";
import { reduceEvents } from "../reduce.js";
import { seededRandom } from "../rng.js";
import type { GameTypes, Input, PlayerId } from "../types.js";

export interface PlayBotsOptions<T extends GameTypes> {
  players: PlayerId[];
  seed: string;
  options?: Json;
  /** A bot per player, or one bot for everyone. Players without a bot don't act. */
  bots: Bot<T> | Partial<Record<PlayerId, Bot<T>>>;
  /** Seeds the bots' own RNG. Defaults to `bots:<seed>`. */
  botSeed?: string;
  maxInputs: number;
}

export interface PlayBotsResult<T extends GameTypes> {
  results: ApplyResult<T>[];
  inputs: Input[];
}

/**
 * Plays a game with synchronous bots until no bot can act, the game ends, or
 * `maxInputs` is reached. For tests; hosts run bots asynchronously.
 */
export function playBots<T extends GameTypes>(
  game: Game<T>,
  opts: PlayBotsOptions<T>,
): PlayBotsResult<T> {
  const random = seededRandom(opts.botSeed ?? `bots:${opts.seed}`);
  const botFor = (p: PlayerId) =>
    typeof opts.bots === "function" ? opts.bots : opts.bots[p];
  const results = [init(game, opts)];
  const inputs: Input[] = [];
  for (let i = 0; i < opts.maxInputs; i++) {
    const last = results.at(-1)!;
    if (last.state.status === "finished") break;
    let input: Input | undefined;
    for (const prompt of last.prompts) {
      const player = prompt.actors.find((p) => botFor(p));
      if (!player) continue;
      const legal = legalInputs(game, last.state, player).filter(
        (x) => x.prompt === prompt.id,
      );
      const answer = botFor(player)!(last.state, prompt, {
        player,
        legal,
        random,
      });
      if (answer instanceof Promise) {
        throw new Error("playBots runs synchronous bots only");
      }
      input = answer;
      break;
    }
    if (!input) break;
    const res = apply(game, last.state, input);
    if (!res.ok) {
      throw new Error(
        `Bot input rejected: ${res.error.code}: ${res.error.message}`,
      );
    }
    inputs.push(input);
    results.push(res);
  }
  return { results, inputs };
}

export interface FuzzOptions {
  /** How many seeds to play (`fuzz-0`, `fuzz-1`, …), or the seeds themselves. */
  seeds: number | string[];
  /** The longest game to play per seed. */
  maxInputs: number;
  players: PlayerId[];
  options?: Json;
}

export interface FuzzFailure {
  seed: string;
  /** The number of inputs applied before the failure. */
  step: number;
  message: string;
}

export interface FuzzReport {
  runs: number;
  inputs: number;
  /** Runs that reached `tx.end`. */
  finished: number;
  failures: FuzzFailure[];
  /**
   * Actions without `enumerate` that were never legal: if they take args,
   * they need `enumerate` to be offered (see Q2).
   */
  warnings: string[];
}

/**
 * Plays random legal inputs from every player. After every apply it checks
 * the state invariants, that a legal input is accepted, and that
 * `reduceEvents` reproduces the new state; after every run, that `replay`
 * rebuilds the final state. Thrown errors (such as `FlowStuckError`) are
 * recorded as failures.
 */
export function fuzz<T extends GameTypes>(
  game: Game<T>,
  opts: FuzzOptions,
): FuzzReport {
  const seeds =
    typeof opts.seeds === "number"
      ? Array.from({ length: opts.seeds }, (_, i) => `fuzz-${i}`)
      : opts.seeds;
  const report: FuzzReport = {
    runs: 0,
    inputs: 0,
    finished: 0,
    failures: [],
    warnings: [],
  };
  const offered = new Set<string>();
  const unenumerable = new Set(
    Object.entries(game.impl.actions ?? {})
      .filter(([, def]) => !def.enumerate)
      .map(([name]) => name),
  );

  for (const seed of seeds) {
    report.runs++;
    const random = seededRandom(`fuzz-inputs:${seed}`);
    const inputs: Input[] = [];
    const fail = (message: string) =>
      report.failures.push({ seed, step: inputs.length, message });
    try {
      let last = init(game, {
        players: opts.players,
        seed,
        options: opts.options,
      });
      while (
        inputs.length < opts.maxInputs &&
        last.state.status === "running"
      ) {
        const legal = opts.players.flatMap((p) =>
          legalInputs(game, last.state, p),
        );
        for (const x of legal) if ("action" in x) offered.add(x.action);
        if (!legal.length) {
          if (last.prompts.length) {
            fail(
              `Prompts open (${last.prompts.map((p) => p.node).join(", ")}) but no legal inputs`,
            );
          }
          break;
        }
        const input = random.pick(legal);
        const res = apply(game, last.state, input);
        if (!res.ok) {
          fail(
            `Legal input rejected: ${res.error.code}: ${res.error.message} (${JSON.stringify(input)})`,
          );
          break;
        }
        inputs.push(input);
        const problems = checkInvariants(res.state);
        if (problems.length) {
          fail(`Invariants broken: ${problems.join("; ")}`);
          break;
        }
        const replayed = reduceEvents(last.state, res.events);
        for (const key of ["entities", "zones", "vars", "status"] as const) {
          if (!jsonEqual(replayed[key], res.state[key])) {
            fail(`reduceEvents doesn't reproduce ${key}`);
          }
        }
        last = res;
      }
      report.inputs += inputs.length;
      if (last.state.status === "finished") report.finished++;
      const rebuilt = replay(game, {
        players: opts.players,
        seed,
        options: opts.options,
        inputs,
      });
      if (!jsonEqual(rebuilt, last.state))
        fail("replay doesn't rebuild the final state");
    } catch (e) {
      fail(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    }
  }
  for (const name of unenumerable) {
    if (!offered.has(name)) {
      report.warnings.push(
        `impl.actions.${name} was never legal without args; if it takes args, give it enumerate`,
      );
    }
  }
  return report;
}
