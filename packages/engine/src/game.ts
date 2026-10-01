import { compile, zonesFor, type CompiledGame } from "./compile.js";
import type { CheckImpl, CheckTypes, GameImpl, TypesOf } from "./impl.js";
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
import { createGameState, untyped } from "./state.js";
import type {
  AnyTypes,
  GameEvent,
  GameState,
  GameTypes,
  Input,
  PlayerId,
  Prompt,
} from "./types.js";

/** A compiled, validated game definition. */
export interface Game<T extends GameTypes = AnyTypes> extends CompiledGame {
  readonly kinds: KindTable;
  /** Phantom: the game's type bundle. */
  readonly __types?: T;
}

/** The type bundle of a defined game. */
export type TypesOfGame<G> = G extends Game<infer T> ? T : AnyTypes;

export interface DefineGameOptions {
  /** Custom node kinds, by kind name. */
  kinds?: Record<string, NodeKind<never>>;
}

/**
 * Compiles and validates a game. Every string ref in the spec must exist in
 * the matching impl map, and every impl entry must be used: both are type
 * errors, and are checked again at runtime. Throws `GameDefinitionError`.
 *
 * Type the impl with `satisfies GameImpl<TypesFor<typeof spec, {...}>>` so
 * handlers are typed while its keys stay literal for the ref check. The
 * game's types are read from the impl's `setup`.
 */
export function defineGame<
  const S extends GameSpec,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any bundle; checked by CheckTypes
  const I extends GameImpl<any>,
>(
  def: { spec: S; impl: I & NoInfer<CheckImpl<S, I> & CheckTypes<I>> },
  opts: DefineGameOptions = {},
): Game<TypesOf<I>> {
  const kinds = new Map<string, NodeKind<never>>(builtinKinds);
  for (const [name, kind] of Object.entries(opts.kinds ?? {}))
    kinds.set(name, kind);
  const compiled = compile(def.spec, def.impl, new Set(kinds.keys()));
  return { ...compiled, kinds };
}

export interface ApplyResult<T extends GameTypes = AnyTypes> {
  ok: true;
  state: GameState<T>;
  events: GameEvent<T>[];
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
export function init<T extends GameTypes>(
  game: Game<T>,
  opts: InitOptions,
): ApplyResult<T> {
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
  const state = createGameState({
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

function result<T extends GameTypes>(rt: Runtime): ApplyResult<T> {
  return {
    ok: true,
    state: rt.state as unknown as GameState<T>,
    events: rt.events as unknown as GameEvent<T>[],
    prompts: openPrompts(rt.state),
  };
}

/** Applies one player input. Invalid inputs return an error; the state is untouched. */
export function apply<T extends GameTypes>(
  game: Game<T>,
  state: GameState<T>,
  input: Input,
): ApplyResult<T> | ApplyError {
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
  const rt = new Runtime(game, game.kinds, untyped(state));
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
export function prompts<T extends GameTypes>(
  _game: Game<T>,
  state: GameState<T>,
): Prompt[] {
  return openPrompts(untyped(state));
}

export interface ReplayOptions extends InitOptions {
  inputs: Input[];
}

/** Rebuilds a game from its seed and inputs. Throws if an input is rejected. */
export function replay<T extends GameTypes>(
  game: Game<T>,
  opts: ReplayOptions,
): GameState<T> {
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
