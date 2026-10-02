import { OpError } from "./errors.js";
import type { StateReader } from "./impl.js";
import type { Json } from "./json.js";
import type { GameState, GameTypes, NodeId } from "./types.js";

/** Builds a `StateReader`. `local` resolves a frame's locals, if any are in scope. */
export function createReader<T extends GameTypes>(
  state: GameState<T>,
  local?: (nodeId?: NodeId) => Json,
): StateReader<T> {
  const s = state as unknown as GameState;
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
  const reader: StateReader = {
    state: s,
    vars: s.vars,
    players: s.players,
    zone,
    entity,
    entities: (zoneId) => zone(zoneId).items.map(entity),
    top: (zoneId) => {
      const id = zone(zoneId).items[0];
      return id === undefined ? undefined : entity(id);
    },
    count: (zoneId) => zone(zoneId).items.length,
    local: (nodeId?: NodeId) => {
      if (!local) throw new OpError("No locals are in scope here");
      return local(nodeId) as never;
    },
  };
  return reader as unknown as StateReader<T>;
}
