import { compile, zonesFor, type CompiledGame } from "./compile.js";
import type { CheckImpl, GameImpl, VarsOf } from "./impl.js";
import {
  inputError,
  Runtime,
  type InputError,
  type KindTable,
  type NodeKind,
} from "./interpreter.js";
import type { Json } from "./json.js";
import { builtinKinds } from "./kinds.js";
import type { GameSpec } from "./spec.js";
import { createGameState } from "./state.js";
import type { GameEvent, GameState, Input, PlayerId, Prompt } from "./types.js";

/** A compiled, validated game definition. */
export interface Game<V extends Json = Json> extends CompiledGame {
  readonly kinds: KindTable;
  /** Phantom: the game's vars type. */
  readonly __vars?: V;
}

export type VarsOfGame<G> = G extends Game<infer V> ? V : Json;

export interface DefineGameOptions {
  /** Custom node kinds, by kind name. */
  kinds?: Record<string, NodeKind<never>>;
}

/**
 * Compiles and validates a game. Every string ref in the spec must exist in
 * the matching impl map, and every impl entry must be used: both are type
 * errors, and are checked again at runtime. Throws `GameDefinitionError`.
 *
 * Type the impl with `satisfies GameImpl<Vars>` so handlers get typed
 * transactions while its keys stay literal for the ref check.
 */
export function defineGame<
  const S extends GameSpec,
  const I extends GameImpl<never>,
>(
  def: { spec: S; impl: I & NoInfer<CheckImpl<S, I>> },
  opts: DefineGameOptions = {},
): Game<VarsOf<I>> {
  const kinds = new Map<string, NodeKind<never>>(builtinKinds);
  for (const [name, kind] of Object.entries(opts.kinds ?? {}))
    kinds.set(name, kind);
  const compiled = compile(
    def.spec,
    def.impl as unknown as GameImpl,
    new Set(kinds.keys()),
  );
  return { ...compiled, kinds };
}

export interface ApplyResult<V extends Json = Json> {
  ok: true;
  state: GameState<V>;
  events: GameEvent[];
  prompts: Prompt[];
}

export interface ApplyError {
  ok: false;
  error: InputError;
}

export interface InitOptions {
  players: PlayerId[];
  seed: string;
  options?: Json;
}

/** Starts a game: runs setup, then settles the flow until it waits for input. */
export function init<V extends Json>(
  game: Game<V>,
  opts: InitOptions,
): ApplyResult<V> {
  const { spec } = game;
  const { players } = opts;
  if (players.length < spec.players.min || players.length > spec.players.max) {
    throw new RangeError(
      `"${spec.id}" takes ${spec.players.min}–${spec.players.max} players, got ${players.length}`,
    );
  }
  if (new Set(players).size !== players.length) {
    throw new RangeError(`Player ids must be unique: ${players.join(", ")}`);
  }
  const state = createGameState<Json>({
    game: spec.id,
    specVersion: spec.version,
    players,
    seed: opts.seed,
    vars: {},
    zones: zonesFor(spec, players),
  });
  const rt = new Runtime(game, game.kinds, state);
  rt.runTx(undefined, 0, (tx) =>
    game.impl.setup(tx, { players, options: opts.options ?? null }),
  );
  if (rt.state.status === "running") {
    rt.start();
    rt.settle();
  }
  return result(rt);
}

function result<V extends Json>(rt: Runtime): ApplyResult<V> {
  const state = rt.state as GameState<V>;
  return { ok: true, state, events: rt.events, prompts: openPrompts(state) };
}

/** Applies one player input. Invalid inputs return an error; the state is untouched. */
export function apply<V extends Json>(
  game: Game<V>,
  state: GameState<V>,
  input: Input,
): ApplyResult<V> | ApplyError {
  const fail = (error: InputError): ApplyError => ({ ok: false, error });
  if (state.status === "finished") {
    return fail(inputError("game_finished", "The game has finished"));
  }
  if (
    state.meta.game !== game.spec.id ||
    state.meta.specVersion !== game.spec.version
  ) {
    throw new RangeError(
      `State is from "${state.meta.game}" v${state.meta.specVersion}, not "${game.spec.id}" v${game.spec.version}`,
    );
  }
  const rt = new Runtime(game, game.kinds, state);
  const found = rt.findPrompt(input.prompt);
  if (!found) {
    return fail(
      inputError("stale_prompt", `Prompt "${input.prompt}" is not open`),
    );
  }
  if (!found.frame.prompt!.actors.includes(input.player)) {
    return fail(
      inputError("not_actor", `${input.player} can't answer "${input.prompt}"`),
    );
  }
  const err = rt.input(found.fiber, found.frame, input);
  if (err) return fail(err);
  rt.settle();
  return result(rt);
}

function openPrompts(state: GameState): Prompt[] {
  return Object.values(state.flow.fibers)
    .filter((f) => f.status === "blocked")
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
    .flatMap((f) => (f.stack.at(-1)?.prompt ? [f.stack.at(-1)!.prompt!] : []));
}

/** The prompts currently open. */
export function prompts<V extends Json>(
  _game: Game<V>,
  state: GameState<V>,
): Prompt[] {
  return openPrompts(state);
}

export interface ReplayOptions extends InitOptions {
  inputs: Input[];
}

/** Rebuilds a game from its seed and inputs. Throws if an input is rejected. */
export function replay<V extends Json>(
  game: Game<V>,
  opts: ReplayOptions,
): GameState<V> {
  let state = init(game, opts).state;
  opts.inputs.forEach((input, i) => {
    const res = apply(game, state, input);
    if (!res.ok) {
      throw new Error(
        `Replay input ${i} was rejected: ${res.error.code}: ${res.error.message}`,
      );
    }
    state = res.state;
  });
  return state;
}
