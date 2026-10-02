import { current, isDraft, type Patch } from "immer";
import { OpError } from "./errors.js";
import { createDraft, finishDraft } from "./immer.js";
import type { DeepReadonly, Json } from "./json.js";
import { createRandom, type Random, type RngState } from "./rng.js";
import type {
  AnyTypes,
  Entity,
  EntityId,
  EntityTypeOf,
  GameEvent,
  GameEventBody,
  GameState,
  GameTypes,
  NodeId,
  PlayerId,
  Position,
  ReadonlyGameState,
  Scope,
  Zone,
  ZoneId,
  ZoneIdOf,
} from "./types.js";

export interface MoveOptions {
  /** Where to insert in the destination. Defaults to "top" for moves. */
  at?: Position;
  /** The entities' `faceUp` after the op. Omitted clears any override. */
  faceUp?: boolean;
}

/**
 * The only way rules code changes state. Every op appends exactly one event;
 * `vars` and `locals` changes become one event each when the transaction
 * commits.
 */
export interface Tx<T extends GameTypes = AnyTypes> {
  /** Reflects changes made so far in this transaction. */
  readonly state: ReadonlyGameState<T>;
  readonly scope: Scope;

  /**
   * An immer draft of `state.vars`. Assigning replaces vars wholesale.
   * Typed as the vars type rather than immer's `Draft`: they're the same for
   * JSON shapes, and `Draft` of recursive JSON is too deep for the checker.
   */
  vars: T["vars"];
  /**
   * A named enclosing frame's locals, as an immer draft, typed by the
   * bundle's `locals`. Locals must be an object or array to be drafted.
   */
  local<N extends keyof T["locals"] & string>(nodeId: N): T["locals"][N];
  /** The nearest frame's locals, untyped. */
  local<L = Json>(): L;

  /** Creates an entity. Defaults to the bottom, so creation order reads top-down. */
  create<K extends EntityTypeOf<T>>(
    type: K,
    props: T["entities"][K & keyof T["entities"]],
    zone: ZoneIdOf<T>,
    opts?: MoveOptions,
  ): EntityId;
  /** Moves entities as a block, keeping their relative order. Moving nothing is a no-op. */
  move(
    ids: EntityId | readonly EntityId[],
    to: ZoneIdOf<T>,
    opts?: MoveOptions,
  ): void;
  /** Moves the top `count` (default 1) entities. Throws if there are fewer. */
  moveTop(
    from: ZoneIdOf<T>,
    to: ZoneIdOf<T>,
    count?: number,
    opts?: MoveOptions,
  ): EntityId[];
  shuffle(zone: ZoneIdOf<T>): void;
  flip(id: EntityId, faceUp: boolean): void;
  destroy(id: EntityId): void;

  readonly random: Random;
  /** A presentation-only notification. */
  emit(name: string, payload?: Json, visibleTo?: PlayerId[] | "all"): void;
  /**
   * Ends the nearest node that handles `outcome`, when the transaction
   * commits. The rest of the handler still runs. The first call wins.
   */
  exit(outcome: string): void;
  /** Finishes the game. */
  end(result?: Json): void;
  /** Phantom: lets `defineGame` infer the bundle from a handler's `tx`. */
  readonly __types?: T;
}

export interface TxOptions {
  scope?: Scope;
  /** Resolves `tx.local(nodeId?)` to the frame holding those locals. */
  locals?: (nodeId?: NodeId) => { node: NodeId; path: (string | number)[] };
}

export interface TxResult<T extends GameTypes = AnyTypes> {
  state: ReadonlyGameState<T>;
  events: GameEvent<T>[];
  /** Set by `tx.exit`. */
  exit?: string;
}

/** Copies drafts (possibly nested in plain values) out to plain JSON. */
function snapshot<T>(value: T): T {
  if (isDraft(value)) return current(value);
  if (Array.isArray(value)) return value.map(snapshot) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = snapshot(v);
    return out as T;
  }
  return value;
}

function startsWith(path: (string | number)[], prefix: (string | number)[]) {
  return path.length >= prefix.length && prefix.every((p, i) => path[i] === p);
}

/** Resolves a position to an index in a zone of `length` items. */
export function resolvePosition(at: Position, length: number): number {
  if (at === "top") return 0;
  if (at === "bottom") return length;
  if (!Number.isInteger(at) || at < 0 || at > length) {
    throw new OpError(`Position ${at} is out of range 0..${length}`);
  }
  return at;
}

// Untyped inside; `openTx` applies the game's types at the boundary.
//
// Entities, zones, meta and the RNG are copied on first write: a transaction
// copies the records and objects it touches, never the whole state. Only
// vars and locals go through immer, since only they need patches. They share
// one draft tree, so values can move between them (a trap's reward from its
// locals into the vars inventory): immer can't finalize a draft from another
// tree.
//
// Q5 (apply throughput), measured in M3 on Blackjack: about 38µs per apply,
// down from about 200µs when the whole state was an immer draft.
class Transaction implements Tx {
  /** The working state: a shallow copy whose parts are copied on first write. */
  private readonly w: GameState;
  /** Objects this transaction created or copied, so it may mutate them. */
  private readonly owned = new Set<object>();
  private readonly events: GameEvent[] = [];
  /** One immer draft over vars and flow (for locals), made on first use. */
  private root: { vars: Json; flow: GameState["flow"] } | undefined;
  /** The locals this transaction reached, by their path in state. */
  private readonly localPaths = new Map<
    string,
    { node: NodeId; path: (string | number)[] }
  >();
  private exitOutcome: string | undefined;
  private done = false;
  readonly random: Random;
  readonly scope: Scope;

  constructor(
    state: GameState,
    private readonly opts: TxOptions,
  ) {
    this.w = { ...state, meta: { ...state.meta } };
    this.owned.add(this.w.meta);
    this.scope = opts.scope ?? {};
    this.random = createRandom(() => {
      this.check();
      return this.rng();
    });
  }

  get state(): DeepReadonly<GameState> {
    this.check();
    return this.w;
  }

  private draft() {
    if (!this.root) {
      const base: object = { vars: this.w.vars, flow: this.w.flow };
      this.root = createDraft(base) as {
        vars: Json;
        flow: GameState["flow"];
      };
      // So tx.state.vars reads the draft
      this.w.vars = this.root.vars;
    }
    return this.root;
  }

  get vars(): Json {
    this.check();
    return this.draft().vars;
  }

  set vars(value: Json) {
    this.check();
    const root = this.draft();
    root.vars = snapshot(value);
    this.w.vars = root.vars;
  }

  local<L = Json>(nodeId?: NodeId): L {
    this.check();
    if (!this.opts.locals) throw new OpError("No locals are in scope here");
    const { node, path } = this.opts.locals(nodeId);
    if (path[0] !== "flow") throw new OpError(`Locals path must start at flow`);
    this.localPaths.set(path.join("\u0000"), { node, path });
    let target: unknown = this.draft();
    for (const k of path)
      target = (target as Record<string | number, unknown>)[k];
    if (!isDraft(target)) {
      throw new OpError(
        `Locals of "${node}" must be an object or array to be changed through tx.local`,
      );
    }
    return target as L;
  }

  create(
    type: string,
    props: Json,
    zone: ZoneId,
    opts: MoveOptions = {},
  ): EntityId {
    this.check();
    const z = this.zoneW(zone);
    const id = `${type}#${this.w.meta.nextEntity++}`;
    const entity: Entity = { id, type, props: snapshot(props), zone };
    if (opts.faceUp !== undefined) entity.faceUp = opts.faceUp;
    const at = resolvePosition(opts.at ?? "bottom", z.items.length);
    z.items.splice(at, 0, id);
    this.entitiesW()[id] = entity;
    this.owned.add(entity);
    this.push({ type: "created", id, entity: { ...entity }, at });
    return id;
  }

  move(
    ids: EntityId | readonly EntityId[],
    to: ZoneId,
    opts: MoveOptions = {},
  ): void {
    this.check();
    const list = typeof ids === "string" ? [ids] : [...ids];
    if (list.length === 0) return;
    if (new Set(list).size !== list.length) {
      throw new OpError(`move: duplicate ids in [${list.join(", ")}]`);
    }
    const target = this.zoneW(to);
    const from = list.map((id) => {
      const zoneId = this.entityR(id).zone;
      const src = this.zoneW(zoneId);
      src.items.splice(src.items.indexOf(id), 1);
      return zoneId;
    });
    const at = resolvePosition(opts.at ?? "top", target.items.length);
    target.items.splice(at, 0, ...list);
    for (const id of list) {
      const e = this.entityW(id);
      e.zone = to;
      if (opts.faceUp === undefined) delete e.faceUp;
      else e.faceUp = opts.faceUp;
    }
    const event: GameEventBody = { type: "moved", ids: list, from, to, at };
    if (opts.faceUp !== undefined) event.faceUp = opts.faceUp;
    this.push(event);
  }

  moveTop(from: ZoneId, to: ZoneId, count = 1, opts?: MoveOptions): EntityId[] {
    this.check();
    const z = this.zoneR(from);
    if (z.items.length < count) {
      throw new OpError(
        `moveTop: zone "${from}" holds ${z.items.length}, needed ${count}`,
      );
    }
    const ids = z.items.slice(0, count);
    this.move(ids, to, opts);
    return ids;
  }

  shuffle(zone: ZoneId): void {
    this.check();
    const z = this.zoneW(zone);
    const order = this.random.shuffle(z.items);
    z.items = order;
    this.push({ type: "shuffled", zone, order: [...order] });
  }

  flip(id: EntityId, faceUp: boolean): void {
    this.check();
    this.entityW(id).faceUp = faceUp;
    this.push({ type: "flipped", id, faceUp });
  }

  destroy(id: EntityId): void {
    this.check();
    const zoneId = this.entityR(id).zone;
    const z = this.zoneW(zoneId);
    z.items.splice(z.items.indexOf(id), 1);
    delete this.entitiesW()[id];
    this.push({ type: "destroyed", id, from: zoneId });
  }

  emit(
    name: string,
    payload: Json = null,
    visibleTo: PlayerId[] | "all" = "all",
  ): void {
    this.check();
    this.push({
      type: "custom",
      name,
      payload: snapshot(payload),
      visibleTo: visibleTo === "all" ? "all" : [...visibleTo],
    });
  }

  exit(outcome: string): void {
    this.check();
    this.exitOutcome ??= outcome;
  }

  end(result: Json = null): void {
    this.check();
    if (this.w.status === "finished")
      throw new OpError("The game has already ended");
    const value = snapshot(result);
    this.w.status = "finished";
    this.w.result = value;
    this.push({ type: "ended", result: value });
  }

  commit(): TxResult {
    this.check();
    this.done = true;
    const w = this.w;
    const input = w.meta.inputCount;

    if (this.root) {
      let patches: Patch[] = [];
      const done = finishDraft(this.root as object, (p) => {
        patches = p;
      }) as { vars: Json; flow: GameState["flow"] };
      w.vars = done.vars;
      w.flow = done.flow;

      const varPatches: Patch[] = [];
      const localPatches = new Map<NodeId, Patch[]>();
      const locals = [...this.localPaths.values()];
      for (const patch of patches) {
        if (patch.path[0] === "vars") {
          varPatches.push({ ...patch, path: patch.path.slice(1) });
          continue;
        }
        const owner = locals.find((l) => startsWith(patch.path, l.path));
        if (owner) {
          const list = localPatches.get(owner.node) ?? [];
          list.push({ ...patch, path: patch.path.slice(owner.path.length) });
          localPatches.set(owner.node, list);
        }
      }
      if (varPatches.length) {
        this.events.push({
          seq: w.meta.eventCount++,
          input,
          type: "vars",
          patches: varPatches,
        });
      }
      for (const [node, p] of localPatches) {
        this.events.push({
          seq: w.meta.eventCount++,
          input,
          type: "locals",
          node,
          patches: p,
        });
      }
    }

    const result: TxResult = { state: w, events: this.events };
    if (this.exitOutcome !== undefined) result.exit = this.exitOutcome;
    return result;
  }

  private check() {
    if (this.done)
      throw new OpError("This transaction has already been committed");
  }

  private push(body: GameEventBody) {
    const meta = this.w.meta;
    this.events.push({
      seq: meta.eventCount++,
      input: meta.inputCount,
      ...body,
    });
  }

  // Copy-on-write accessors: `R` reads, `W` returns a copy this tx owns

  private rng(): RngState {
    if (!this.owned.has(this.w.rng)) {
      this.w.rng = [...this.w.rng];
      this.owned.add(this.w.rng);
    }
    return this.w.rng;
  }

  private zoneR(id: ZoneId): Zone {
    const z = this.w.zones[id];
    if (!z) throw new OpError(`Unknown zone "${id}"`);
    return z;
  }

  private zoneW(id: ZoneId): Zone {
    const z = this.zoneR(id);
    if (this.owned.has(z)) return z;
    if (!this.owned.has(this.w.zones)) {
      this.w.zones = { ...this.w.zones };
      this.owned.add(this.w.zones);
    }
    const copy = { ...z, items: [...z.items] };
    this.w.zones[id] = copy;
    this.owned.add(copy);
    return copy;
  }

  private entitiesW(): GameState["entities"] {
    if (!this.owned.has(this.w.entities)) {
      this.w.entities = { ...this.w.entities };
      this.owned.add(this.w.entities);
    }
    return this.w.entities;
  }

  private entityR(id: EntityId): Entity {
    const e = this.w.entities[id];
    if (!e) throw new OpError(`Unknown entity "${id}"`);
    return e;
  }

  private entityW(id: EntityId): Entity {
    const e = this.entityR(id);
    if (this.owned.has(e)) return e;
    const copy = { ...e };
    this.entitiesW()[id] = copy;
    this.owned.add(copy);
    return copy;
  }
}

export interface OpenTx<T extends GameTypes> {
  tx: Tx<T>;
  commit: () => TxResult<T>;
}

/** Opens a transaction over `state`, which is never mutated. */
export function openTx<T extends GameTypes = AnyTypes>(
  state: ReadonlyGameState<T>,
  opts: TxOptions = {},
): OpenTx<T> {
  const t = new Transaction(state as unknown as GameState, opts);
  return {
    tx: t as unknown as Tx<T>,
    commit: () => t.commit() as unknown as TxResult<T>,
  };
}

/** Runs `fn` in a transaction and commits it. */
export function transact<T extends GameTypes = AnyTypes>(
  state: ReadonlyGameState<T>,
  fn: (tx: Tx<T>) => void,
  opts?: TxOptions,
): TxResult<T> {
  const { tx, commit } = openTx(state, opts);
  fn(tx);
  return commit();
}
