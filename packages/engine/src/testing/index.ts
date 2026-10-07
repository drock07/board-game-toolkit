// Testing helpers: a seeded random bot, fuzzing, and checks that views hide
// what they should and that events replay to the new state and to each
// player's new view.
import { isPlainJson, jsonEqual, stableStringify } from "../json.js";
import {
  actors,
  apply,
  check,
  init,
  legalInputs,
  type InitOptions,
} from "../play.js";
import { seededRandom, type Random } from "../rng.js";
import { hashJson } from "../serialize.js";
import type {
  GameDef,
  GameEvent,
  Input,
  PlayerId,
  State,
  View,
  ViewEvent,
} from "../types.js";
import { replay, view, viewEvents } from "../views.js";
import { canSee } from "../zones.js";

/** A bot that picks uniformly from the legal inputs it's given, seeded. */
export function randomBot(seed: string) {
  const random = seededRandom(seed);
  return <I extends Input>(legal: readonly I[]): I => random.pick(legal);
}

/** Every entity a player may not see must be a placeholder in their view. */
export function checkViews<V>(game: GameDef<V>, state: State<V>): void {
  for (const player of state.players) {
    const v = view(game, state, player);
    for (const e of Object.values(state.entities)) {
      const shown = v.entities[e.ref]!;
      const visible = canSee(game, e, player);
      if (visible !== !("hidden" in shown))
        throw new Error(
          `${player}'s view ${visible ? "hides" : "shows"} ${e.id}`,
        );
      if ("hidden" in shown && ("props" in shown || "id" in shown))
        throw new Error(`${player}'s view leaks ${e.id}`);
    }
  }
}

/** Applies an input that must be legal; throws with the reason otherwise. */
export function applyOrThrow<V>(
  game: GameDef<V>,
  state: State<V>,
  input: Input,
): State<V> {
  const out = apply(game, state, input);
  if (!out.ok) throw new Error(out.reason);
  return out.state;
}

/** Replaying `events` onto `before` gives `after`, and so does each player's share of them onto their view. */
export function checkEvents<V>(
  game: GameDef<V>,
  before: State<V>,
  events: readonly GameEvent<V>[],
  after: State<V>,
): void {
  // What events rebuild; a view's `waiting` and `shown` come from the flow
  const pick = (s: State<V> | View<V>) => ({
    vars: s.vars,
    zones: s.zones,
    entities: s.entities,
    status: s.status,
    result: s.result,
  });
  if (!jsonEqual(pick(replay(before, events)), pick(after)))
    throw new Error("Replaying the events doesn't give the new state");
  for (const player of before.players) {
    const mine = viewEvents(game, events, player);
    if (
      !jsonEqual(
        pick(replay(view(game, before, player), mine)),
        pick(view(game, after, player)),
      )
    )
      throw new Error(
        `Replaying ${player}'s events doesn't give their new view`,
      );
    const carried = (ev: ViewEvent<V>) =>
      "entity" in ev ? [ev.entity] : "entities" in ev ? ev.entities : [];
    const leaked = mine.find(
      (ev) =>
        carried(ev).some((e) => "hidden" in e && ("props" in e || "id" in e)) ||
        (ev.type === "effect" && ev.to && !ev.to.includes(player)),
    );
    if (leaked)
      throw new Error(`${player}'s events leak a ${leaked.type} event`);
  }
}

export interface FuzzOptions {
  /** How many seeds (`fuzz-0`, `fuzz-1`, …), or the seeds themselves. */
  seeds: number | readonly string[];
  players: PlayerId[];
  maxInputs: number;
}

export interface FuzzFailure {
  seed: string;
  step: number;
  message: string;
}

export function fuzz<V>(
  game: GameDef<V>,
  opts: FuzzOptions,
): { runs: number; finished: number; inputs: number; failures: FuzzFailure[] } {
  const failures: FuzzFailure[] = [];
  let finished = 0;
  let inputs = 0;
  const seeds =
    typeof opts.seeds === "number"
      ? Array.from({ length: opts.seeds }, (_, i) => `fuzz-${i}`)
      : opts.seeds;
  for (const seed of seeds) {
    const bot = randomBot(seed);
    let s: State<V> = init(game, { players: opts.players, seed });
    let step = 0;
    try {
      checkViews(game, s);
      for (
        ;
        step < opts.maxInputs && s.status === "running";
        step++, inputs++
      ) {
        const legal = legalInputs(game, s);
        if (legal.length === 0) throw new Error("No legal input");
        for (const input of legal) {
          const ok = check(game, s, input);
          if (ok !== true)
            throw new Error(
              `enumerate offered an input validate rejects: ${ok}`,
            );
        }
        const out = apply(game, s, bot(legal));
        if (!out.ok) throw new Error(out.reason);
        checkEvents(game, s, out.events, out.state);
        s = out.state;
        if (!isPlainJson(s)) throw new Error("State is not plain JSON");
        checkViews(game, s);
      }
      if (s.status === "finished") finished++;
    } catch (e) {
      failures.push({ seed, step, message: (e as Error).message });
    }
  }
  return { runs: seeds.length, finished, inputs, failures };
}

// --- Golden replays ----------------------------------------------------------

export { replayInputs } from "../serialize.js";
export { stableStringify };

/** A short, stable hash of a state, for golden replay fixtures. */
export function hashState<V>(state: State<V>): string {
  return hashJson(state);
}

/** Applies inputs in order and returns every state, starting with `init`'s. Throws on a rejected input. */
export function simulate<V>(
  game: GameDef<V>,
  opts: InitOptions & { inputs: readonly Input[] },
): State<V>[] {
  const states = [init(game, opts)];
  opts.inputs.forEach((input, i) => {
    const out = apply(game, states.at(-1)!, input);
    if (!out.ok) throw new Error(`Input ${i} was rejected: ${out.reason}`);
    states.push(out.state);
  });
  return states;
}

/** A recorded game: replaying its inputs from its seed must reach the same state. */
export interface GoldenReplay {
  players: PlayerId[];
  seed: string;
  inputs: Input[];
  finalStateHash: string;
}

/**
 * Plays a game by asking `choose` for each input, until it returns undefined,
 * the game ends or `maxInputs` is reached, and records it as a golden replay.
 * Check one later with `hashState(replayInputs(game, golden, golden.inputs))`.
 */
export function record<V>(
  game: GameDef<V>,
  opts: InitOptions & { maxInputs: number },
  choose: (state: State<V>, step: number) => Input | undefined,
): { golden: GoldenReplay; states: State<V>[] } {
  const states = [init(game, opts)];
  const inputs: Input[] = [];
  for (let i = 0; i < opts.maxInputs; i++) {
    const last = states.at(-1)!;
    if (last.status === "finished") break;
    const input = choose(last, i);
    if (!input) break;
    const out = apply(game, last, input);
    if (!out.ok) throw new Error(`Input ${i} was rejected: ${out.reason}`);
    inputs.push(input);
    states.push(out.state);
  }
  return {
    golden: {
      players: opts.players,
      seed: opts.seed,
      inputs,
      finalStateHash: hashState(states.at(-1)!),
    },
    states,
  };
}

// --- Bots in tests -------------------------------------------------------------

/**
 * Picks a seat's input from its legal ones. The same shape as the React
 * host's bots, but synchronous, so tests can play whole games.
 */
export type SyncBot<V, I> = (
  legal: readonly I[],
  ctx: { view: View<V>; player: PlayerId; random: Random },
) => I;

/**
 * Plays `game` with bots: one for every seat, or one per seat by id. Stops
 * when it ends, nobody can act, or after `maxInputs`. Every input is checked
 * as `apply` would. Returns each state, starting with `init`'s, and the
 * inputs, ready for a golden replay.
 */
export function playBots<V, I extends Input>(
  game: GameDef<V>,
  opts: InitOptions & {
    bots: SyncBot<V, I> | Record<PlayerId, SyncBot<V, I>>;
    maxInputs: number;
  },
): { states: State<V>[]; inputs: I[] } {
  const states = [init(game, opts)];
  const inputs: I[] = [];
  const random = seededRandom(`bots:${opts.seed}`);
  const botFor = (p: PlayerId) =>
    typeof opts.bots === "function" ? opts.bots : opts.bots[p];
  for (let i = 0; i < opts.maxInputs; i++) {
    const s = states.at(-1)!;
    if (s.status === "finished") break;
    const player = actors(game, s).find((p) => botFor(p));
    if (player === undefined) break;
    const legal = legalInputs(game, s, player) as I[];
    if (!legal.length) break;
    const input = botFor(player)!(legal, {
      view: view(game, s, player),
      player,
      random,
    });
    const out = apply(game, s, input);
    if (!out.ok)
      throw new Error(`Input ${i} by ${player} was rejected: ${out.reason}`);
    inputs.push(input);
    states.push(out.state);
  }
  return { states, inputs };
}
