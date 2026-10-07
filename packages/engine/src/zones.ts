import type {
  Entity,
  EntityId,
  FamilyRef,
  GameDef,
  PlayerId,
  Spec,
  State,
  ZoneId,
  ZoneRef,
} from "./types.js";

/** A zone instance id: `name`, `name:owner`, `name:index` or `name:owner:index`. */
export function zoneId(name: string, owner?: PlayerId, index?: number): ZoneId {
  return [name, owner, index].filter((x) => x !== undefined).join(":");
}

export function parseZone(
  spec: Spec,
  id: ZoneId,
): { name: string; owner?: PlayerId; index?: number } {
  const [name, ...rest] = id.split(":") as [string, ...string[]];
  const def = spec.zones[name];
  const out: { name: string; owner?: PlayerId; index?: number } = { name };
  if (def?.perPlayer) {
    const owner = rest.shift();
    if (owner !== undefined) out.owner = owner;
  }
  if (def?.count !== undefined) {
    const index = rest.shift();
    if (index !== undefined) out.index = Number(index);
  }
  return out;
}

/** A family's instances in seat order then index order; only `player`'s when given. */
export function zonesOf<V>(
  game: GameDef<V>,
  state: State<V>,
  family: FamilyRef,
  player?: PlayerId,
): ZoneRef[] {
  if (!game.spec.zones[family.name])
    throw new Error(`Unknown zone "${family.name}"`);
  const seat = (owner?: PlayerId) =>
    owner === undefined ? -1 : state.players.indexOf(owner);
  return Object.keys(state.zones)
    .map((id) => ({ id, ...parseZone(game.spec, id) }))
    .filter(
      (z) =>
        z.name === family.name && (player === undefined || z.owner === player),
    )
    .sort(
      (a, b) =>
        seat(a.owner) - seat(b.owner) || (a.index ?? 0) - (b.index ?? 0),
    )
    .map((z) => ({ id: z.id }));
}

export function itemsOf<V>(state: State<V>, zone: ZoneRef): EntityId[] {
  const items = state.zones[zone.id];
  if (!items) throw new Error(`Unknown zone "${zone.id}"`);
  return items;
}

export function entityOf<V>(state: State<V>, id: EntityId): Entity {
  const e = state.entities[id];
  if (!e) throw new Error(`Unknown entity "${id}"`);
  return e;
}

/** Whether `viewer` may see `entity`'s props. */
export function canSee<V>(
  game: GameDef<V>,
  entity: Entity,
  viewer: PlayerId,
): boolean {
  if (entity.faceUp !== undefined) return entity.faceUp;
  const { name, owner } = parseZone(game.spec, entity.zone);
  const def = game.spec.zones[name]!;
  if (def.visibility === "public") return true;
  if (def.visibility === "owner") return owner === viewer;
  return false;
}
