import { isEffect, triggered } from "./effects.js";
import { RulesError } from "./errors.js";
import {
  boundActor,
  nearestFrame,
  nodeOf,
  scopeOf,
  stackOf,
  withStack,
  type FrameAt,
} from "./frames.js";
import { jsonEqual } from "./json.js";
import { createRandom, type RngState } from "./rng.js";
import type {
  EffectData,
  EntityId,
  FiberId,
  GameDef,
  GameEvent,
  MoveOptions,
  State,
  Tx,
  ZoneId,
  ZoneRef,
} from "./types.js";
import { entitiesOf, entityOf, itemsOf, zonesOf } from "./zones.js";

/** Runs `body` on a copy of `state`, appending what it did to `log`. */
export function transact<V>(
  game: GameDef<V>,
  state: State<V>,
  log: GameEvent<V>[],
  fiber: FiberId,
  body: (tx: Tx<V>) => void,
): State<V> {
  const at = log.length;
  // An effect's scope is its data, handed out as a draft and kept if changed
  const drafts = new Map<string, { where: FrameAt; data: unknown }>();
  const scope = (id: string): unknown => {
    const where = nearestFrame(state, fiber, id);
    if (!where || nodeOf(game, id).kind !== "effect")
      return scopeOf(game, state, fiber, id);
    const key = `${where.fiber}:${where.index}`;
    if (!drafts.has(key))
      drafts.set(key, {
        where,
        data: structuredClone((where.frame.data as EffectData).data),
      });
    return drafts.get(key)!.data;
  };
  const next: State<V> = {
    ...state,
    vars: structuredClone(state.vars),
    rng: [...state.rng] as RngState,
    entities: { ...state.entities },
    zones: { ...state.zones },
    flow: [...state.flow],
    fibers: { ...state.fibers },
  };
  const items = (zone: ZoneRef) => itemsOf(next, zone);
  const place = (ids: readonly EntityId[], to: ZoneRef, opts?: MoveOptions) => {
    const from: ZoneId[] = [];
    for (const id of ids) {
      const e = next.entities[id];
      if (!e) throw new RulesError(`Unknown entity "${id}"`);
      from.push(e.zone);
      next.zones[e.zone] = items({ id: e.zone }).filter((x) => x !== id);
    }
    next.zones[to.id] = [...ids, ...items(to)];
    for (const id of ids) {
      const e = next.entities[id]!;
      const { faceUp: _, ...rest } = e;
      next.entities[id] =
        opts?.faceUp === undefined
          ? { ...rest, zone: to.id }
          : { ...rest, zone: to.id, faceUp: opts.faceUp };
    }
    log.push({
      type: "moved",
      from,
      to: to.id,
      entities: ids.map((id) => next.entities[id]!),
    });
  };
  // Draws advance this transaction's own copy of the state
  const random = createRandom(() => next.rng);
  const tx: Tx<V> = {
    players: state.players,
    get actor() {
      return boundActor(game, state, fiber);
    },
    scopeOf: scope,
    get vars() {
      return next.vars;
    },
    set vars(v) {
      next.vars = v;
    },
    entities: (zone) => entitiesOf(next, zone),
    count: (zone) => items(zone).length,
    zones: (family, player) => zonesOf(game, next, family, player),
    entity: (id) => entityOf(next, id),
    destroy(id) {
      const e = entityOf(next, id);
      next.zones[e.zone] = items({ id: e.zone }).filter((x) => x !== id);
      delete next.entities[id];
      log.push({ type: "destroyed", entity: e });
    },
    update({ id }, patch) {
      const e = entityOf(next, id);
      next.entities[id] = { ...e, props: { ...(e.props as object), ...patch } };
      log.push({ type: "updated", entity: next.entities[id] });
    },
    create(type, props, zone) {
      const id = `${type.name}#${next.nextEntity++}`;
      const ref = `r${next.nextRef++}`;
      next.entities[id] = { id, ref, type: type.name, props, zone: zone.id };
      next.zones[zone.id] = [...items(zone), id];
      log.push({ type: "created", entity: next.entities[id] });
      return id;
    },
    move(ids, to, opts) {
      place(typeof ids === "string" ? [ids] : ids, to, opts);
    },
    moveTop(from, to, count = 1, opts) {
      const ids = items(from).slice(0, count);
      if (ids.length < count)
        throw new RulesError(
          `"${from.id}" has ${ids.length} entities, not ${count}`,
        );
      place(ids, to, opts);
      return ids;
    },
    shuffle(zone) {
      const order = [...items(zone)];
      for (let i = order.length - 1; i > 0; i--) {
        const j = random.int(i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      next.zones[zone.id] = order;
      // New refs in the new order, so no ref says which entity went where
      for (const id of order)
        next.entities[id] = {
          ...next.entities[id]!,
          ref: `r${next.nextRef++}`,
        };
      log.push({
        type: "shuffled",
        zone: zone.id,
        entities: order.map((id) => next.entities[id]!),
      });
    },
    flip(id, faceUp) {
      const e = next.entities[id];
      if (!e) throw new RulesError(`Unknown entity "${id}"`);
      next.entities[id] = { ...e, faceUp };
      log.push({ type: "flipped", entity: next.entities[id] });
    },
    random,
    end(result) {
      next.status = "finished";
      next.result = result;
      log.push({ type: "ended", result });
    },
    cause({ name }, data) {
      if (!isEffect(game, name))
        throw new RulesError(
          `"${name}" isn't one of this game's effects: declare it with \`effect\` before calling \`rules\``,
        );
      const to = game.impl.effects[name]?.to?.(data);
      log.push({ type: "effect", name, data, ...(to && { to }) });
    },
  };
  body(tx);
  if (!jsonEqual(state.vars, next.vars))
    log.push({ type: "vars", vars: next.vars });
  let out = next;
  // A reaction's changes to the effect it reacts to are kept in the effect's frame
  for (const { where, data } of drafts.values()) {
    if (jsonEqual(data, (where.frame.data as EffectData).data)) continue;
    const stack = stackOf(out, where.fiber);
    out = withStack(
      out,
      where.fiber,
      stack.map((f, i) =>
        i === where.index
          ? { ...f, data: { ...(f.data as EffectData), data } }
          : f,
      ),
    );
  }
  // What this transaction fired runs before anything queued earlier
  const fired = triggered(game, out, log.slice(at), fiber, "after", true);
  if (fired.length) out = { ...out, pending: [...fired, ...out.pending] };
  return out;
}
