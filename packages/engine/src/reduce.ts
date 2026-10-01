import { applyPatches, produce } from "immer";
import type { Json } from "./json.js";
import type { GameEvent, GameState } from "./types.js";

/**
 * Replays events onto a state. Rebuilds `entities`, `zones`, `vars`, `status`
 * and `result`; `flow`, `rng` and `meta` are left as they were. Hosts use this
 * to compute intermediate states for animation.
 *
 * Replay property: `reduceEvents(before, apply(before).events)` equals the
 * applied state on entities, zones, vars and status.
 */
export function reduceEvents<V extends Json>(
  state: GameState<V>,
  events: readonly GameEvent[],
): GameState<V> {
  // Typed as a plain `GameState`: immer's `Draft` of recursive JSON is too
  // deep for the checker
  return produce(state as GameState, (d) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc hits the depth limit without it
    for (const event of events) reduceOne(d as unknown as GameState, event);
  }) as GameState<V>;
}

function reduceOne(d: GameState, event: GameEvent) {
  switch (event.type) {
    case "created": {
      d.entities[event.id] = structuredClone(event.entity);
      d.zones[event.entity.zone]!.items.splice(event.at, 0, event.id);
      return;
    }
    case "moved": {
      for (const id of event.ids) {
        const e = d.entities[id]!;
        const items = d.zones[e.zone]!.items;
        items.splice(items.indexOf(id), 1);
        e.zone = event.to;
        if (event.faceUp === undefined) delete e.faceUp;
        else e.faceUp = event.faceUp;
      }
      d.zones[event.to]!.items.splice(event.at, 0, ...event.ids);
      return;
    }
    case "shuffled":
      d.zones[event.zone]!.items = [...event.order];
      return;
    case "flipped":
      d.entities[event.id]!.faceUp = event.faceUp;
      return;
    case "destroyed": {
      const items = d.zones[event.from]!.items;
      items.splice(items.indexOf(event.id), 1);
      delete d.entities[event.id];
      return;
    }
    case "vars":
      // immer can't patch a root, so a wholesale replacement is done here
      for (const patch of event.patches) {
        if (patch.path.length === 0)
          d.vars = structuredClone(patch.value as Json);
        else applyPatches(d.vars as Record<string, Json>, [patch]);
      }
      return;
    case "ended":
      d.status = "finished";
      d.result = structuredClone(event.result);
      return;
    case "locals":
    case "custom":
    case "flow":
      return;
  }
}
