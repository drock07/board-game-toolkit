import {
  depthOf,
  framesOut,
  mayMove,
  nearestEffect,
  reader,
  stackOf,
  withStack,
} from "./frames.js";
import {
  ROOT,
  type AbilityScope,
  type EffectData,
  type FiberId,
  type GameDef,
  type GameEvent,
  type Pending,
  type PlayerId,
  type State,
} from "./types.js";
import { parseZone } from "./zones.js";

export const isEffect = <V>(game: GameDef<V>, name: string) =>
  (game.spec.effects ?? []).some((e) => e.name === name);

/** Nested interrupt frames allowed before a chain is called a loop. */
export const MAX_DEPTH = 32;

/**
 * What `events` set off, in order: by event, then by owner in seat order
 * from the fiber's bound actor (unowned first), then by ability and entity
 * order. With `effects`, a caused effect queues the effect itself (its
 * abilities fire from its frame); otherwise abilities of `timing` match. An
 * ability fires for an entity already in its zone.
 */
export function triggered<V>(
  game: GameDef<V>,
  s: State<V>,
  events: readonly GameEvent<V>[],
  fiber: FiberId,
  timing: "before" | "after",
  effects: boolean,
): Pending[] {
  const abilities = (game.spec.abilities ?? []).filter(
    (a) => a.timing === timing,
  );
  if (!events.length) return [];
  const r = reader(game, s, fiber);
  const depth =
    1 + Math.max(0, ...framesOut(s, fiber).map((f) => depthOf(game, f)));
  const first = Math.max(0, s.players.indexOf(r.actor ?? ""));
  const seat = (p?: PlayerId) =>
    p === undefined
      ? -1
      : (s.players.indexOf(p) - first + s.players.length) % s.players.length;
  const out: Pending[] = [];
  for (const event of events) {
    // At a transaction's end a caused effect is queued itself; its frame fires its abilities
    if (effects && event.type === "custom" && isEffect(game, event.name)) {
      out.push({ effect: event.name, data: event.data, fiber, depth });
      continue;
    }
    const hits: Pending[] = [];
    for (const a of abilities) {
      if (a.of === undefined) {
        if (!game.impl.abilities[a.id]!(r, event)) continue;
        const owner = game.impl.abilityOwners[a.id]?.(r, event);
        hits.push({
          ability: a.id,
          fiber,
          ...(owner !== undefined && { owner }),
          event: event as GameEvent,
          depth,
        });
        continue;
      }
      for (const e of Object.values(s.entities)) {
        if (e.type !== a.of) continue;
        const { name, owner } = parseZone(game.spec, e.zone);
        if (name !== a.in || !game.impl.abilities[a.id]!(r, event, e)) continue;
        hits.push({
          ability: a.id,
          fiber,
          self: e.id,
          ...(owner !== undefined && { owner }),
          event: event as GameEvent,
          depth,
        });
      }
    }
    const owner = (x: Pending) => ("owner" in x ? x.owner : undefined);
    out.push(...hits.sort((x, y) => seat(owner(x)) - seat(owner(y))));
  }
  if (out.length && depth > MAX_DEPTH) {
    const what = "ability" in out[0]! ? out[0].ability : out[0]!.effect;
    throw new Error(
      `"${what}" fired ${depth} interrupts deep: an ability is probably triggering itself`,
    );
  }
  return out;
}

/**
 * Whether a queued interrupt may start: not while its fiber is still
 * running an interrupt of the same batch or deeper, nor while another
 * fiber's ability pauses everyone. So a batch runs one at a time, each
 * checked again when its turn comes, and what a running handler sets off
 * (one level deeper) nests inside it.
 */
export function isReady<V>(
  game: GameDef<V>,
  s: State<V>,
  p: Pending,
  paused?: FiberId,
): boolean {
  if (p.fiber !== ROOT && !(p.fiber in s.fibers)) return true; // dropped by interrupt
  if (!mayMove(s, p.fiber, paused)) return false;
  return framesOut(s, p.fiber).every((f) => depthOf(game, f) < p.depth);
}

/** An effect's event with the data its frame holds now, which earlier reactions may have changed. */
export function liveEvent<V>(
  game: GameDef<V>,
  s: State<V>,
  fiber: FiberId,
  event: GameEvent,
): GameEvent {
  if (event.type !== "custom" || !isEffect(game, event.name)) return event;
  const at = nearestEffect(game, s, fiber);
  return at ? { ...event, data: (at.frame.data as EffectData).data } : event;
}

/**
 * Starts queued interrupt `at` as a frame on top of its fiber. An ability
 * starts only if it still holds: its entity is still in its zone and the
 * event, as it is now, still fires it.
 */
export function interrupt<V>(
  game: GameDef<V>,
  state: State<V>,
  at: number,
): State<V> {
  const p = state.pending[at]!;
  const s = { ...state, pending: state.pending.filter((_, i) => i !== at) };
  if (p.fiber !== ROOT && !(p.fiber in s.fibers)) return s;
  if ("effect" in p) {
    const node = game.spec.effects!.find((e) => e.name === p.effect)!;
    const data: EffectData = { data: p.data, depth: p.depth, phase: "before" };
    return withStack(s, p.fiber, [
      ...stackOf(s, p.fiber),
      { id: node.id, i: 0, data },
    ]);
  }
  const a = (game.spec.abilities ?? []).find((x) => x.id === p.ability)!;
  const self = p.self === undefined ? undefined : s.entities[p.self];
  const event = liveEvent(game, s, p.fiber, p.event);
  const carried = a.of !== undefined;
  if (
    (carried && (!self || parseZone(game.spec, self.zone).name !== a.in)) ||
    !game.impl.abilities[a.id]!(
      reader(game, s, p.fiber),
      event as GameEvent<V>,
      self,
    )
  )
    return s;
  const data: AbilityScope = {
    ...(p.self !== undefined && { self: p.self }),
    ...(p.owner !== undefined && { owner: p.owner }),
    event,
    depth: p.depth,
  };
  return withStack(s, p.fiber, [
    ...stackOf(s, p.fiber),
    { id: a.id, i: 0, data },
  ]);
}
