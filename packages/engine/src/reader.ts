import { OpError } from "./errors.js";
import type { StateReader } from "./impl.js";
import type { DeepReadonly, Json } from "./json.js";
import type { GameState, NodeId } from "./types.js";

/** Builds a `StateReader`. `local` resolves a frame's locals, if any are in scope. */
export function createReader<V extends Json>(
  state: GameState<V>,
  local?: (nodeId?: NodeId) => Json,
): StateReader<V> {
  const s = state as GameState;
  const zone = (id: string) => {
    const z = s.zones[id];
    if (!z) throw new OpError(`Unknown zone "${id}"`);
    return z;
  };
  const entity = (id: string) => {
    const e = s.entities[id];
    if (!e) throw new OpError(`Unknown entity "${id}"`);
    return e;
  };
  return {
    state: state as unknown as DeepReadonly<GameState<V>>,
    vars: state.vars as unknown as DeepReadonly<V>,
    players: state.players,
    zone,
    entity,
    entities: (zoneId) => zone(zoneId).items.map(entity),
    top: (zoneId) => {
      const id = zone(zoneId).items[0];
      return id === undefined ? undefined : entity(id);
    },
    count: (zoneId) => zone(zoneId).items.length,
    local: <L>(nodeId?: NodeId) => {
      if (!local) throw new OpError("No locals are in scope here");
      return local(nodeId) as DeepReadonly<L>;
    },
  };
}
