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
import { untyped } from "../state.js";
import type { GameEvent, GameTypes, Input, PlayerId } from "../types.js";
import {
  canSee,
  statesAlong,
  view,
  viewEventsOver,
  type PlayerView,
  type Viewer,
} from "../view.js";

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
    // The first prompt (by fiber) with a bot player who has a legal input
    let input: Input | undefined;
    for (const prompt of last.prompts) {
      for (const player of prompt.actors) {
        const bot = botFor(player);
        if (!bot) continue;
        const legal = legalInputs(game, last.state, player).filter(
          (x) => x.prompt === prompt.id,
        );
        if (!legal.length) continue;
        const answer = bot(view(game, last.state, player), prompt, {
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
      if (input) break;
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

/**
 * Freezes a value deeply. Stops at frozen objects: states share unchanged
 * parts with earlier states, which are already frozen.
 */
export function deepFreeze<V>(value: V): V {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
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

/** Adds every string shaped like an entity id (`type#n`) in a JSON value. */
function addIdsIn(value: unknown, out: Set<string>): Set<string> {
  if (value === undefined) return out;
  for (const s of JSON.stringify(value).match(/"[^"?]*#\d+"/g) ?? []) {
    out.add(s.slice(1, -1));
  }
  return out;
}

/**
 * The entity ids a view shows. Entities and zones are read directly; only
 * the free-form parts are scanned, which keeps the check fast.
 */
function idsInView(v: PlayerView): Set<string> {
  const out = new Set<string>(Object.keys(v.entities));
  for (const e of Object.values(v.entities)) out.add(e.id);
  for (const z of Object.values(v.zones))
    for (const id of z?.items ?? []) out.add(id);
  return addIdsIn([v.vars, v.locals, v.prompts, v.result], out);
}

/** The entity ids a list of events shows. */
function idsInEvents(events: readonly GameEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    switch (e.type) {
      case "created":
        out.add(e.id).add(e.entity.id);
        break;
      case "moved":
        for (const id of e.ids) out.add(id);
        break;
      case "shuffled":
        for (const id of e.order) out.add(id);
        break;
      case "flipped":
      case "destroyed":
        out.add(e.id);
        break;
      case "vars":
      case "locals":
        addIdsIn(e.patches, out);
        break;
      case "custom":
        addIdsIn(e.payload, out);
        break;
      case "ended":
        addIdsIn(e.result, out);
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Hidden entity ids that a player's (or a spectator's) view or events
 * reveal. An id may appear in events if the viewer could see the entity
 * before or after them.
 */
function leaks<T extends GameTypes>(
  game: Game<T>,
  before: ApplyResult<T>["state"],
  after: ApplyResult<T>,
  players: PlayerId[],
): string[] {
  const s0 = untyped(before);
  const s1 = untyped(after.state);
  const found: string[] = [];
  const along = statesAlong(before, after.events);
  for (const viewer of [...players, "spectator"] as Viewer[]) {
    const seenNow = (id: string) => canSee(game, s1, id, viewer);
    const hidden = Object.keys(s1.entities).filter((id) => !seenNow(id));
    const inView = idsInView(view(game, after.state, viewer) as PlayerView);
    for (const id of hidden)
      if (inView.has(id)) found.push(`view for ${viewer} leaks ${id}`);
    const neverSeen = new Set(
      [...Object.keys(s0.entities), ...hidden].filter(
        (id) => !canSee(game, s0, id, viewer) && !seenNow(id),
      ),
    );
    const inEvents = idsInEvents(
      viewEventsOver(game, along, after.events, viewer) as GameEvent[],
    );
    for (const id of neverSeen)
      if (inEvents.has(id)) found.push(`events for ${viewer} leak ${id}`);
  }
  return found;
}

/**
 * Plays random legal inputs from every player. Every state is deep-frozen
 * before the next input, so an engine or rules bug that mutates a state it
 * was given throws. After every apply it checks the state invariants, that a legal input is accepted, and that
 * `reduceEvents` reproduces the new state; after every run, that `replay`
 * rebuilds the final state, and that no player's or spectator's view or
 * events reveal an entity id they can't see. Thrown errors (such as `FlowStuckError`) are
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
      deepFreeze(last);
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
        deepFreeze(res);
        const problems = checkInvariants(res.state);
        if (problems.length) {
          fail(`Invariants broken: ${problems.join("; ")}`);
          break;
        }
        for (const leak of leaks(game, last.state, res, opts.players))
          fail(leak);
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
