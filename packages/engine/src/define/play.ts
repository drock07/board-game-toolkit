// The engine entry points, typed by the game's actions.
import {
  actors as actorsOf,
  check as checkInput,
  legalInputs as legal,
  apply as run,
  init as start,
  current as whose,
  type InitOptions,
} from "../play.js";
import type { Applied, PlayerId, State } from "../types.js";
import {
  viewEvents as eventsFor,
  replay as fold,
  view as viewOf,
} from "../views.js";
import type { Game, InputOf } from "./types.js";

// --- Typed engine entry points ---------------------------------------------

export function init<V, H>(game: Game<V, H>, opts: InitOptions): State<V> {
  return start(game, opts);
}

/** The new state and its events, or `{ ok: false, reason }` for an illegal input. */
export function apply<V, H>(
  game: Game<V, H>,
  state: State<V>,
  input: InputOf<H>,
): Applied<V> {
  return run(game, state, input);
}

export function check<V, H>(
  game: Game<V, H>,
  state: State<V>,
  input: InputOf<H>,
): true | string {
  return checkInput(game, state, input);
}

/** Every input `player` could give now, or every actor's when no player is given. */
export function legalInputs<V, H>(
  game: Game<V, H>,
  state: State<V>,
  player?: PlayerId,
): InputOf<H>[] {
  return legal(game, state, player) as InputOf<H>[];
}

export const current = whose;
export const actors = actorsOf;
export const view = viewOf;
export const viewEvents = eventsFor;
export const replay = fold;
