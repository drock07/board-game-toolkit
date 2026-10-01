import type { Json } from "./json.js";
import { seedRng } from "./rng.js";
import type { GameState, PlayerId, Zone } from "./types.js";

export interface CreateStateOptions<V extends Json> {
  game: string;
  specVersion: number;
  players: PlayerId[];
  seed: string;
  vars: V;
  zones: Omit<Zone, "items">[];
}

/** An empty game state: no entities, zones as given, no flow yet. */
export function createGameState<V extends Json>(
  opts: CreateStateOptions<V>,
): GameState<V> {
  const zones: GameState["zones"] = {};
  for (const z of opts.zones) zones[z.id] = { ...z, items: [] };
  return {
    meta: {
      game: opts.game,
      specVersion: opts.specVersion,
      inputCount: 0,
      eventCount: 0,
      nextEntity: 0,
    },
    players: [...opts.players],
    vars: opts.vars,
    entities: {},
    zones,
    rng: seedRng(opts.seed),
    flow: { fibers: {}, rootFiber: "f0", nextFiberId: 0, nextPromptId: 1 },
    status: "running",
  };
}
