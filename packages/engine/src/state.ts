import { seedRng } from "./rng.js";
import type {
  AnyTypes,
  GameState,
  GameTypes,
  PlayerId,
  Zone,
} from "./types.js";

export interface CreateStateOptions<T extends GameTypes> {
  game: string;
  specVersion: number;
  players: PlayerId[];
  seed: string;
  vars: T["vars"];
  zones: Omit<Zone, "items">[];
}

/** An empty game state: no entities, zones as given, no flow yet. */
export function createGameState<T extends GameTypes = AnyTypes>(
  opts: CreateStateOptions<T>,
): GameState<T> {
  const zones: GameState["zones"] = {};
  for (const z of opts.zones) zones[z.id] = { ...z, items: [] };
  const state: GameState = {
    meta: {
      game: opts.game,
      specVersion: opts.specVersion,
      inputCount: 0,
      eventCount: 0,
      nextEntity: 0,
    },
    players: [...opts.players],
    vars: opts.vars as GameState["vars"],
    entities: {},
    zones,
    rng: seedRng(opts.seed),
    flow: { fibers: {}, rootFiber: "f0", nextFiberId: 0, nextPromptId: 1 },
    status: "running",
  };
  return state as unknown as GameState<T>;
}

/** Drops a state's game types, for engine internals. */
export function untyped<T extends GameTypes>(state: GameState<T>): GameState {
  return state as unknown as GameState;
}
