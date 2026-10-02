import { applyPatches } from "./immer.js";
import type { Json } from "./json.js";
import type {
  Entity,
  GameEvent,
  GameState,
  GameTypes,
  ReadonlyGameState,
  Zone,
} from "./types.js";

/**
 * Replays events onto a state. Rebuilds `entities`, `zones`, `vars`, `status`
 * and `result`; `flow`, `rng` and `meta` are left as they were. Hosts use this
 * to compute intermediate states for animation. The input is never mutated.
 *
 * Replay property: `reduceEvents(before, apply(before).events)` equals the
 * applied state on entities, zones, vars and status.
 */
export function reduceEvents<T extends GameTypes>(
  state: ReadonlyGameState<T>,
  events: readonly GameEvent<T>[],
): ReadonlyGameState<T> {
  const r = new Reducer(state as unknown as GameState);
  for (const event of events) r.apply(event as unknown as GameEvent);
  return r.state as unknown as ReadonlyGameState<T>;
}

/** Applies events with copy-on-write, copying only what they touch. */
class Reducer {
  readonly state: GameState;
  private readonly owned = new Set<object>();

  constructor(state: GameState) {
    this.state = { ...state };
  }

  apply(event: GameEvent) {
    const s = this.state;
    switch (event.type) {
      case "created": {
        const entity = structuredClone(event.entity);
        this.entities()[event.id] = entity;
        this.owned.add(entity);
        this.zone(event.entity.zone).items.splice(event.at, 0, event.id);
        return;
      }
      case "moved": {
        for (const id of event.ids) {
          const e = this.entity(id);
          const items = this.zone(e.zone).items;
          items.splice(items.indexOf(id), 1);
          e.zone = event.to;
          if (event.faceUp === undefined) delete e.faceUp;
          else e.faceUp = event.faceUp;
        }
        this.zone(event.to).items.splice(event.at, 0, ...event.ids);
        return;
      }
      case "shuffled":
        this.zone(event.zone).items = [...event.order];
        return;
      case "flipped":
        this.entity(event.id).faceUp = event.faceUp;
        return;
      case "destroyed": {
        const items = this.zone(event.from).items;
        items.splice(items.indexOf(event.id), 1);
        delete this.entities()[event.id];
        return;
      }
      case "vars":
        // immer can't patch a root, so a wholesale replacement is done here
        for (const patch of event.patches) {
          if (patch.path.length === 0)
            s.vars = structuredClone(patch.value as Json);
          else s.vars = applyPatches(s.vars as object, [patch]) as Json;
        }
        return;
      case "ended":
        s.status = "finished";
        s.result = structuredClone(event.result);
        return;
      case "locals":
      case "custom":
      case "flow":
        return;
    }
  }

  private entities(): GameState["entities"] {
    if (!this.owned.has(this.state.entities)) {
      this.state.entities = { ...this.state.entities };
      this.owned.add(this.state.entities);
    }
    return this.state.entities;
  }

  private entity(id: string): Entity {
    const e = this.state.entities[id]!;
    if (this.owned.has(e)) return e;
    const copy = { ...e };
    this.entities()[id] = copy;
    this.owned.add(copy);
    return copy;
  }

  private zone(id: string): Zone {
    const z = this.state.zones[id]!;
    if (this.owned.has(z)) return z;
    if (!this.owned.has(this.state.zones)) {
      this.state.zones = { ...this.state.zones };
      this.owned.add(this.state.zones);
    }
    const copy = { ...z, items: [...z.items] };
    this.state.zones[id] = copy;
    this.owned.add(copy);
    return copy;
  }
}
