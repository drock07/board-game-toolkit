// The box: entity types, effects and zones, as typed handles.
import type {
  EffectRef,
  Entity,
  FamilyRef,
  HiddenEntity,
  PlayerId,
  Tx,
  TypeRef,
  Visibility,
  ZoneDef,
  ZoneRef,
} from "../types.js";

export type { ZoneRef };

/** An entity type with typed props: `const card = entity<Card>("card")`. */
export interface EntityType<P> extends TypeRef<P> {
  /** Narrows an entity to this type, so its props are typed. */
  readonly is: (e: Entity | HiddenEntity) => e is Entity<P>;
}

export function entity<P>(name: string): EntityType<P> {
  return { name, is: (e): e is Entity<P> => "type" in e && e.type === name };
}

/**
 * Something that happens, with typed data: every custom event is one. Caused
 * with `tx.cause(effect, data)`, it runs in three phases: abilities `on:
 * effect.before` (which may change its data), `resolve`, then abilities `on:
 * effect`. `to` limits who sees it in their events. Make one with `effect`
 * from `define`.
 */
export interface Effect<V, T> extends EffectRef<T> {
  resolve?(tx: Tx<V>, data: T): void;
  to?(data: T): readonly PlayerId[];
  /** Reacting before it resolves: `ability({ on: attack.before, ... })`. */
  readonly before: Before<V, T>;
}

/** An effect's "before" phase, as an ability's `on`. */
export interface Before<V, T> {
  readonly effect: Effect<V, T>;
  readonly timing: "before";
}

interface ZoneBase<P> extends FamilyRef<P> {
  readonly def: ZoneDef;
  /** The entity type it holds, so `define` can check that type names are unique. */
  readonly holds: EntityType<P>;
  /** For `count` given as a function: registered at `define`. */
  readonly countOf?: (players: number) => number;
}

export interface SharedZone<P> extends ZoneBase<P>, ZoneRef<P> {}

export interface PerPlayerZone<P> extends ZoneBase<P> {
  /** The player's instance: `hand.of("ann")` is `"hand:ann"`. */
  of(player: PlayerId): ZoneRef<P>;
}

export interface CountedZone<P> extends ZoneBase<P> {
  /** Instance `index`: `factory.at(2)` is `"factory:2"`. */
  at(index: number): ZoneRef<P>;
}

export interface PerPlayerCountedZone<P> extends ZoneBase<P> {
  /** The player's instance `index`: `line.of("ann", 3)` is `"line:ann:3"`. */
  of(player: PlayerId, index: number): ZoneRef<P>;
}

/** Any zone declaration; `s.zones(family)` lists its instances. */
export type ZoneFamily<P> =
  | SharedZone<P>
  | PerPlayerZone<P>
  | CountedZone<P>
  | PerPlayerCountedZone<P>;
export type AnyZone = ZoneFamily<unknown>;

type Count = number | ((players: number) => number);

export function zone<P>(
  name: string,
  opts: {
    holds: EntityType<P>;
    visibility?: Exclude<Visibility, "owner">;
    perPlayer?: false;
    count?: undefined;
  },
): SharedZone<P>;
export function zone<P>(
  name: string,
  opts: {
    holds: EntityType<P>;
    visibility?: Visibility;
    perPlayer: true;
    count?: undefined;
  },
): PerPlayerZone<P>;
export function zone<P>(
  name: string,
  opts: {
    holds: EntityType<P>;
    visibility?: Exclude<Visibility, "owner">;
    perPlayer?: false;
    count: Count;
  },
): CountedZone<P>;
export function zone<P>(
  name: string,
  opts: {
    holds: EntityType<P>;
    visibility?: Visibility;
    perPlayer: true;
    count: Count;
  },
): PerPlayerCountedZone<P>;
export function zone<P>(
  name: string,
  opts: {
    holds: EntityType<P>;
    visibility?: Visibility;
    perPlayer?: boolean;
    count?: Count | undefined;
  },
): ZoneFamily<P> {
  const def: ZoneDef = {
    holds: opts.holds.name,
    visibility: opts.visibility ?? "public",
  };
  if (opts.perPlayer) def.perPlayer = true;
  const base: ZoneBase<P> = { name, def, holds: opts.holds };
  if (typeof opts.count === "function") {
    def.count = { ref: name };
    (base as { countOf?: Count }).countOf = opts.count;
  } else if (opts.count !== undefined) {
    def.count = opts.count;
  }
  const counted = opts.count !== undefined;
  if (opts.perPlayer && counted) {
    const z: PerPlayerCountedZone<P> = {
      ...base,
      of: (player, index) => ({ id: `${name}:${player}:${index}` }),
    };
    return z;
  }
  if (opts.perPlayer) {
    const z: PerPlayerZone<P> = {
      ...base,
      of: (player) => ({ id: `${name}:${player}` }),
    };
    return z;
  }
  if (counted) {
    const z: CountedZone<P> = {
      ...base,
      at: (index) => ({ id: `${name}:${index}` }),
    };
    return z;
  }
  const z: SharedZone<P> = { ...base, id: name };
  return z;
}
