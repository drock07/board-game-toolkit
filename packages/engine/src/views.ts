import type {
  Entity,
  EntityId,
  GameDef,
  GameEvent,
  HiddenEntity,
  PlayerId,
  Ref,
  State,
  View,
  ViewEvent,
  ZoneId,
} from "./types.js";
import { canSee } from "./zones.js";

/** An entity as `viewer` may see it: itself, or a placeholder. */
export function seen<V>(
  game: GameDef<V>,
  e: Entity,
  viewer: PlayerId,
): Entity | HiddenEntity {
  return canSee(game, e, viewer)
    ? e
    : { ref: e.ref, zone: e.zone, hidden: true };
}

/** The state as `viewer` may see it. */
export function view<V>(
  game: GameDef<V>,
  state: State<V>,
  viewer: PlayerId,
): View<V> {
  const entities: View<V>["entities"] = {};
  for (const e of Object.values(state.entities))
    entities[e.ref] = seen(game, e, viewer);
  const zones: View<V>["zones"] = {};
  for (const [zone, ids] of Object.entries(state.zones))
    zones[zone] = ids.map((id) => state.entities[id]!.ref);
  return {
    player: viewer,
    vars: state.vars,
    zones,
    entities,
    status: state.status,
    ...(state.result !== undefined && { result: state.result }),
  };
}

/**
 * The events `viewer` may see. Entities they can't see become placeholders;
 * a hidden entity's `updated` is dropped, and so is a custom event not
 * addressed to them. `replay(view(before), viewEvents(...))` is `view(after)`.
 */
export function viewEvents<V>(
  game: GameDef<V>,
  events: readonly GameEvent<V>[],
  viewer: PlayerId,
): ViewEvent<V>[] {
  const see = (e: Entity) => seen(game, e, viewer);
  const out: ViewEvent<V>[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case "created":
      case "flipped":
      case "destroyed":
        out.push({ ...ev, entity: see(ev.entity) });
        break;
      case "updated":
        if (canSee(game, ev.entity, viewer)) out.push(ev);
        break;
      case "moved":
      case "shuffled":
        out.push({ ...ev, entities: ev.entities.map(see) });
        break;
      case "effect":
        if (!ev.to || ev.to.includes(viewer)) out.push(ev);
        break;
      default:
        out.push(ev);
    }
  }
  return out;
}

/** What `replay` rebuilds: a state (keyed by id) or a view (keyed by ref). */
export interface Replayable<V, E> {
  vars: V;
  zones: Record<ZoneId, string[]>;
  entities: Record<string, E>;
  status: "running" | "finished";
  result?: unknown;
}

/**
 * Folds events onto a state or a view, rebuilding its vars, zones, entities,
 * status and result; everything else is left as it was. Never mutates `s`.
 */
export function replay<V>(
  s: State<V>,
  events: readonly GameEvent<V>[],
): State<V>;
export function replay<V>(s: View<V>, events: readonly ViewEvent<V>[]): View<V>;
export function replay<V, E extends { ref: Ref; zone: ZoneId; id?: EntityId }>(
  s: Replayable<V, E> & { player?: PlayerId },
  events: readonly GameEvent<V, E>[],
): Replayable<V, E> {
  // A view is keyed by ref, a state by id
  const key = (e: E) => (s.player !== undefined ? e.ref : e.id!);
  const out = { ...s, entities: { ...s.entities }, zones: { ...s.zones } };
  const remove = (k: string) => {
    const zone = out.entities[k]!.zone;
    out.zones[zone] = out.zones[zone]!.filter((x) => x !== k);
    delete out.entities[k];
  };
  for (const ev of events) {
    switch (ev.type) {
      case "created":
        out.entities[key(ev.entity)] = ev.entity;
        out.zones[ev.entity.zone] = [
          ...out.zones[ev.entity.zone]!,
          key(ev.entity),
        ];
        break;
      case "moved":
        for (const e of ev.entities) remove(key(e));
        for (const e of ev.entities) out.entities[key(e)] = e;
        out.zones[ev.to] = [...ev.entities.map(key), ...out.zones[ev.to]!];
        break;
      case "shuffled":
        // Refs changed, so drop the zone's old keys and add the new ones
        for (const k of out.zones[ev.zone]!) delete out.entities[k];
        for (const e of ev.entities) out.entities[key(e)] = e;
        out.zones[ev.zone] = ev.entities.map(key);
        break;
      case "flipped":
      case "updated":
        out.entities[key(ev.entity)] = ev.entity;
        break;
      case "destroyed":
        remove(key(ev.entity));
        break;
      case "vars":
        out.vars = ev.vars;
        break;
      case "ended":
        out.status = "finished";
        if (ev.result !== undefined) out.result = ev.result;
        break;
      case "effect":
        break;
    }
  }
  return out;
}
