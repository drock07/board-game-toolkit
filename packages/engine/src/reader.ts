import { OpError } from "./errors.js";
import type { StateReader } from "./impl.js";
import type { DeepReadonly, Json } from "./json.js";
import type { GameState, GameTypes, NodeId, PlayerId, Zone } from "./types.js";

/** A zone definition's instances, in seat order then index order. */
export function zoneFamily(
  state: DeepReadonly<GameState>,
  def: string,
  player?: PlayerId,
): DeepReadonly<Zone>[] {
  const seat = (z: DeepReadonly<Zone>) =>
    z.owner === undefined ? -1 : state.players.indexOf(z.owner);
  return Object.values(state.zones)
    .filter(
      (z) => z.def === def && (player === undefined || z.owner === player),
    )
    .sort((a, b) => seat(a) - seat(b) || (a.index ?? 0) - (b.index ?? 0));
}

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
    zonesOf: (def, player) => zoneFamily(s, def, player),
    local: (nodeId?: NodeId) => {
      if (!local) throw new OpError("No locals are in scope here");
      return local(nodeId) as never;
    },
  };
  return reader as unknown as StateReader<T>;
}
