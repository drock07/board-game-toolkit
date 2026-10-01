import { untyped } from "./state.js";
import type { GameState, GameTypes } from "./types.js";

/**
 * Checks the state model's invariants and returns a message per violation:
 * every entity is in exactly one zone, `entity.zone` matches that zone, and
 * no id is past the entity counter (so ids are never reused).
 */
export function checkInvariants<T extends GameTypes>(
  typed: GameState<T>,
): string[] {
  const state: GameState = untyped(typed);
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const [zoneId, zone] of Object.entries(state.zones)) {
    if (zone.id !== zoneId) errors.push(`Zone "${zoneId}" has id "${zone.id}"`);
    for (const id of zone.items) {
      const prev = seen.get(id);
      if (prev !== undefined) {
        errors.push(`Entity "${id}" is in both "${prev}" and "${zoneId}"`);
      }
      seen.set(id, zoneId);
      const e = state.entities[id];
      if (!e) errors.push(`Zone "${zoneId}" lists unknown entity "${id}"`);
      else if (e.zone !== zoneId) {
        errors.push(
          `Entity "${id}" says zone "${e.zone}" but is in "${zoneId}"`,
        );
      }
    }
  }
  for (const [id, e] of Object.entries(state.entities)) {
    if (e.id !== id) errors.push(`Entity "${id}" has id "${e.id}"`);
    if (!seen.has(id)) errors.push(`Entity "${id}" is in no zone`);
    const n = Number(id.slice(id.lastIndexOf("#") + 1));
    if (!Number.isInteger(n) || n >= state.meta.nextEntity) {
      errors.push(`Entity "${id}" is not from the entity counter`);
    }
  }
  return errors;
}
