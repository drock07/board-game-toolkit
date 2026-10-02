import type { CompiledGame } from "./compile.js";
import { GameDefinitionError } from "./errors.js";
import type { DeepReadonly, Json } from "./json.js";
import { createReader } from "./reader.js";
import { reduceEvents } from "./reduce.js";
import { untyped } from "./state.js";
import type {
  AnyTypes,
  Entity,
  EntityId,
  EntityOf,
  GameEvent,
  GameState,
  GameTypes,
  NodeId,
  PlayerId,
  Prompt,
  ReadonlyGameState,
  ZoneId,
  ZonesOf,
} from "./types.js";

// `PlayerId & {}` keeps "spectator" from collapsing into string
export type Viewer = (PlayerId & {}) | "spectator";

/** An entity the viewer can't see: positional, so it doesn't leak identity across shuffles. */
export interface HiddenEntity {
  /** `?<zoneId>#<index>`. */
  id: string;
  hidden: true;
  zone: ZoneId;
  /** Only when the zone sets `revealType` (e.g. differing card backs). */
  type?: string;
}

export type ViewEntity<T extends GameTypes = AnyTypes> =
  | DeepReadonly<EntityOf<T>>
  | HiddenEntity;

/** What one player (or a spectator) may see of a game. */
export interface PlayerView<T extends GameTypes = AnyTypes> {
  viewer: Viewer;
  meta: DeepReadonly<GameState["meta"]>;
  players: readonly PlayerId[];
  /** Vars marked `hidden` are absent; `owner` vars hold only the viewer's entry. */
  vars: DeepReadonly<Partial<T["vars"]>>;
  /** Visible entities by id, and hidden ones by their opaque id. */
  entities: Readonly<Record<string, ViewEntity<T>>>;
  /** Zone items list opaque ids for hidden entities. */
  zones: DeepReadonly<ZonesOf<T>>;
  /** Open prompts. Other players' prompts are reduced to `{ id, node, kind, actors }`. */
  prompts: readonly Prompt[];
  /** Locals of every running node, by node id. Locals are public. */
  locals: Readonly<Record<NodeId, Json>>;
  status: GameState["status"];
  result?: Json;
}

export const isHidden = (
  e: ViewEntity<never> | ViewEntity,
): e is HiddenEntity => "hidden" in e;

/** Whether `viewer` can see an entity in `state`. `faceUp`, when set, overrides the zone. */
export function canSee(
  game: CompiledGame,
  state: GameState,
  id: EntityId,
  viewer: Viewer,
): boolean {
  const e = state.entities[id];
  if (!e) return false;
  if (e.faceUp !== undefined) return e.faceUp;
  const zone = state.zones[e.zone]!;
  const def = game.spec.zones[zone.def];
  if (!def)
    throw new GameDefinitionError(`Unknown zone definition "${zone.def}"`);
  const vis = def.visibility;
  switch (vis) {
    case "public":
      return true;
    case "hidden":
      return false;
    case "owner":
      return zone.owner !== undefined && zone.owner === viewer;
    case "top":
      return zone.items[0] === id;
    default: {
      const fn = game.impl.visibility?.[vis.ref];
      if (!fn)
        throw new GameDefinitionError(`Missing impl.visibility.${vis.ref}`);
      return fn(createReader(state), e, viewer);
    }
  }
}

/** The opaque id of an entity: its position in its zone. */
function opaqueId(state: GameState, id: EntityId, index?: number): string {
  const e = state.entities[id]!;
  return `?${e.zone}#${index ?? state.zones[e.zone]!.items.indexOf(id)}`;
}

function hiddenEntity(
  game: CompiledGame,
  state: GameState,
  e: Entity,
  index?: number,
): HiddenEntity {
  const zone = state.zones[e.zone]!;
  const h: HiddenEntity = {
    id: opaqueId(state, e.id, index),
    hidden: true,
    zone: e.zone,
  };
  if (game.spec.zones[zone.def]?.revealType) h.type = e.type;
  return h;
}

/** Vars as `viewer` may see them, per `spec.vars` visibility. */
export function filterVars(
  game: CompiledGame,
  vars: Json,
  viewer: Viewer,
): Json {
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) return vars;
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(vars)) {
    const vis = game.spec.vars?.[key]?.visibility ?? "public";
    if (vis === "hidden") continue;
    out[key] = vis === "owner" ? ownerEntry(value, viewer) : value;
  }
  return out;
}

function ownerEntry(value: Json, viewer: Viewer): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return viewer in value ? { [viewer]: value[viewer]! } : {};
}

/** Builds what `viewer` may see of a state. */
export function view<T extends GameTypes>(
  game: CompiledGame & { readonly __types?: T },
  typed: ReadonlyGameState<T>,
  viewer: Viewer,
): PlayerView<T> {
  const state = untyped(typed);
  const entities: Record<string, Entity | HiddenEntity> = {};
  const zones: GameState["zones"] = {};
  for (const zone of Object.values(state.zones)) {
    zones[zone.id] = {
      ...zone,
      items: zone.items.map((id, index) => {
        const e = state.entities[id]!;
        if (canSee(game, state, id, viewer)) {
          entities[id] = e;
          return id;
        }
        const h = hiddenEntity(game, state, e, index);
        entities[h.id] = h;
        return h.id;
      }),
    };
  }
  const prompts: Prompt[] = [];
  const locals: Record<NodeId, Json> = {};
  const fibers = Object.values(state.flow.fibers).sort(
    (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );
  for (const fiber of fibers) {
    for (const frame of fiber.stack)
      if (frame.locals !== undefined) locals[frame.node] = frame.locals;
    const p =
      fiber.status === "blocked" ? fiber.stack.at(-1)?.prompt : undefined;
    if (!p) continue;
    prompts.push(
      p.actors.includes(viewer)
        ? p
        : { id: p.id, node: p.node, kind: p.kind, actors: p.actors },
    );
  }
  const out: PlayerView = {
    viewer,
    meta: state.meta,
    players: state.players,
    vars: filterVars(game, state.vars, viewer),
    entities,
    zones,
    prompts,
    locals,
    status: state.status,
  };
  if (state.result !== undefined) out.result = state.result;
  return out as unknown as PlayerView<T>;
}

/**
 * The events `viewer` may see, given the state before them. Ids of entities
 * the viewer can't see before or after an event become opaque; a move
 * reveals the real id to viewers who can see either end. Custom events
 * respect `visibleTo`, and vars patches follow var visibility.
 */
export function viewEvents<T extends GameTypes>(
  game: CompiledGame & { readonly __types?: T },
  before: ReadonlyGameState<T>,
  events: readonly GameEvent<T>[],
  viewer: Viewer,
): GameEvent<T>[] {
  return viewEventsOver(game, statesAlong(before, events), events, viewer);
}

/** The state before `events` and after each one: `events.length + 1` states. */
export function statesAlong<T extends GameTypes>(
  before: ReadonlyGameState<T>,
  events: readonly GameEvent<T>[],
): GameState[] {
  const states = [untyped(before)];
  for (const event of events) {
    states.push(
      untyped(reduceEvents(states.at(-1)!, [event as unknown as GameEvent])),
    );
  }
  return states;
}

/** `viewEvents` with the states along the events precomputed, to share across viewers. */
export function viewEventsOver<T extends GameTypes>(
  game: CompiledGame & { readonly __types?: T },
  states: readonly GameState[],
  events: readonly GameEvent<T>[],
  viewer: Viewer,
): GameEvent<T>[] {
  let i = 0;
  let s0 = states[0]!;
  const out: GameEvent[] = [];
  for (const typedEvent of events) {
    const event = typedEvent as unknown as GameEvent;
    const s1 = states[++i]!;
    const shown = (id: EntityId) =>
      canSee(game, s0, id, viewer) || canSee(game, s1, id, viewer);
    const idIn = (id: EntityId) =>
      shown(id) ? id : opaqueId(s1.entities[id] ? s1 : s0, id);
    switch (event.type) {
      case "created":
        out.push(
          shown(event.id)
            ? event
            : {
                ...event,
                id: opaqueId(s1, event.id),
                entity: hiddenEntity(game, s1, event.entity) as never,
              },
        );
        break;
      case "moved":
        out.push({ ...event, ids: event.ids.map(idIn) });
        break;
      case "shuffled":
        out.push({ ...event, order: event.order.map(idIn) });
        break;
      case "flipped":
        out.push({ ...event, id: idIn(event.id) });
        break;
      case "destroyed":
        out.push({
          ...event,
          id: canSee(game, s0, event.id, viewer)
            ? event.id
            : opaqueId(s0, event.id),
        });
        break;
      case "vars": {
        const patches = event.patches.flatMap((patch) => {
          if (patch.path.length === 0) {
            return [
              {
                ...patch,
                value: filterVars(game, patch.value as Json, viewer),
              },
            ];
          }
          const vis =
            game.spec.vars?.[String(patch.path[0])]?.visibility ?? "public";
          if (vis === "hidden") return [];
          if (vis === "owner") {
            if (patch.path.length === 1)
              return [
                { ...patch, value: ownerEntry(patch.value as Json, viewer) },
              ];
            if (patch.path[1] !== viewer) return [];
          }
          return [patch];
        });
        if (patches.length) out.push({ ...event, patches });
        break;
      }
      case "custom":
        if (event.visibleTo === "all" || event.visibleTo.includes(viewer))
          out.push(event);
        break;
      default:
        out.push(event);
    }
    s0 = s1;
  }
  return out as unknown as GameEvent<T>[];
}
