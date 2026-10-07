import type { Random, RngState } from "./rng.js";

export type PlayerId = string;
export type EntityId = string;
export type ZoneId = string;
/** An entity's public handle: `r12`. */
export type Ref = string;

/** A spec node of a custom kind: the engine only needs its kind and id. */
export type CustomNode = { kind: string; id: string; [key: string]: unknown };

export type Node =
  | CustomNode
  | AbilityNode
  | EffectNode
  | { kind: "seq"; id: string; children: Node[] }
  | { kind: "step"; id: string; run: string }
  /** Turns until `until` holds or `rounds` full passes are done. */
  | {
      kind: "turns";
      id: string;
      order: "clockwise" | "counterclockwise";
      until?: string;
      /** A query naming the first player. Defaults to the first seat. */
      from?: string;
      /** A query listing who may take a turn; others are skipped. */
      among?: string;
      rounds?: number;
      body: Node;
    }
  /** Repeats the body until `until` holds, checked before each pass. */
  /** Repeats the body until `until` holds (forever when absent), checked before each pass. */
  | { kind: "loop"; id: string; until?: string; body: Node }
  | { kind: "prompt"; id: string; label?: string; actions: string[] }
  /** A prompt held open across several answers; see `kinds/turn.ts`. */
  | {
      kind: "turn";
      id: string;
      label?: string;
      until?: string;
      limits?: Record<string, number>;
      first?: string[];
      actions: string[];
    }
  /** Waits for the first answer from any of `who` (a query; every player when absent). */
  | {
      kind: "anyone";
      id: string;
      label?: string;
      who?: string;
      actions: string[];
    }
  /** Runs `body` once per player, all at once, each on its own fiber. */
  | { kind: "simultaneous"; id: string; body: Node }
  /** Runs the first case whose condition holds, or `else`. */
  | {
      kind: "branch";
      id: string;
      cases: { when: string; then: Node }[];
      else?: Node;
    }
  /**
   * The ways `body` may end early. An outcome with `when` is a guard, checked
   * after every transaction; any outcome may be raised from inside by a step
   * or action returning `{ exit }`. Raising cancels the body, runs `then`
   * if there is one, and the node ends.
   */
  | {
      kind: "outcomes";
      id: string;
      outcomes: Record<string, { when?: string; then?: Node }>;
      body: Node;
    };

/**
 * Who sees a zone's entities: everyone, no one, the zone's owner, or (for
 * "top") everyone sees only the top entity. In a "top" zone the engine
 * manages `faceUp` itself.
 */
export type Visibility = "public" | "hidden" | "owner" | "top";

export interface ZoneDef {
  visibility: Visibility;
  perPlayer?: boolean;
  /** Instances `0..count-1`; a `ref` names an `impl.zoneCounts` entry run at init. */
  count?: number | { ref: string };
  /** The entity type it holds. */
  holds: string;
}

/**
 * An ability: live while an entity of type `of` is in a zone of family `in`
 * (owned by that zone's owner), or, without them, game-wide (owned by `who`).
 */
export interface AbilityNode {
  kind: "ability";
  id: string;
  of?: string;
  in?: string;
  /** Effects only: whether it reacts before the effect resolves or after. */
  timing: "before" | "after";
  /** "everyone": while it runs, no other fiber moves or takes input. */
  pause?: "everyone";
  body: Node;
}

/** An effect: a custom event with phases. Its resolution is `impl.effects[name]`. */
export interface EffectNode {
  kind: "effect";
  id: string;
  name: string;
}

export interface Spec {
  players: { min: number; max: number };
  zones: Record<string, ZoneDef>;
  flow: Node;
  abilities?: AbilityNode[];
  effects?: EffectNode[];
}

// --- State ------------------------------------------------------------------

export interface Entity<P = unknown> {
  readonly id: EntityId;
  /** The public handle views key it by. `shuffle` gives its zone's entities new ones. */
  readonly ref: Ref;
  readonly type: string;
  readonly props: P;
  readonly zone: ZoneId;
  /** Overrides the zone's visibility for this entity when set. */
  readonly faceUp?: boolean;
}

/** Anything that names a zone instance: `"deck"`, `"hand:ann"`. */
/** Anything that names a zone instance holding `P`: `"deck"`, `"hand:ann"`. */
export interface ZoneRef<P = unknown> {
  readonly id: ZoneId;
  readonly __holds?: P;
}

/** Anything that names an entity type. */
/** Anything that names an entity type with props `P`. */
export interface TypeRef<P = unknown> {
  readonly name: string;
  readonly __props?: P;
}

export interface Frame {
  id: string;
  /** The seq's next child; the turns' or loop's passes started. */
  i: number;
  /** Owned by the frame's kind. Must be JSON. */
  data?: unknown;
  /** Child fibers this frame spawned and waits on. */
  children?: FiberId[];
}

export type FiberId = string;
export const ROOT: FiberId = "root";

/** A child stack of frames, spawned by a frame of its parent fiber. */
export interface Fiber {
  id: FiberId;
  parent: FiberId;
  /** The spawning frame's index in the parent's stack. */
  at: number;
  /** The player this fiber acts for, when spawned per player. */
  player?: PlayerId;
  stack: Frame[];
}

export interface State<V> {
  players: PlayerId[];
  vars: V;
  rng: RngState;
  entities: Record<EntityId, Entity>;
  /** Zone id → entity ids, top first. */
  zones: Record<ZoneId, EntityId[]>;
  nextEntity: number;
  nextRef: number;
  flow: Frame[];
  /** Child fibers by id, in creation order. The root fiber's stack is `flow`. */
  fibers: Record<FiberId, Fiber>;
  nextFiber: number;
  status: "running" | "finished";
  result?: unknown;
  inputs: number;
  /** Abilities that fired and haven't started yet, next first. */
  pending: Pending[];
}

/** A matched ability, or a caused effect, waiting to run as an interrupt on `fiber`. */
export type Pending = {
  fiber: FiberId;
  /** How many interrupt frames this one is nested in, plus one. */
  depth: number;
} & (
  | { ability: string; self?: EntityId; owner?: PlayerId; event: GameEvent }
  | { effect: string; data: unknown }
);

/** An effect frame's data: its (changeable) payload and where it is in its phases. */
export interface EffectData {
  data: unknown;
  depth: number;
  phase: "before" | "resolve" | "after" | "done";
}

/** What an ability frame shows its handler through `s.scopeOf`. */
export interface AbilityScope {
  /** The entity carrying it; absent for a game-wide ability. */
  self?: EntityId;
  owner?: PlayerId;
  event: GameEvent;
  depth: number;
}

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** A zone family by definition name. */
export interface FamilyRef<P = unknown> {
  readonly name: string;
  readonly __holds?: P;
}

/** Anything that names an effect with data `T`. */
export interface EffectRef<T = unknown> {
  readonly name: string;
  readonly __data?: T;
}

/**
 * Reads a node's scope: what the nearest frame of that node shows the nodes
 * under it (an ability's `AbilityScope`, an effect's data), or undefined
 * outside one. Kind authors wrap it in typed accessors closed over the
 * node's id, as an ability's `t.self` and `t.data` do.
 */
export interface Scoped {
  scopeOf(node: string): unknown;
}

/** Read-only access to the game, for conditions, queries and legality. */
export interface Reader<V> extends Scoped {
  readonly players: readonly PlayerId[];
  /**
   * What kinds show here, by kind name, as in a view's `shown`: read it
   * through a kind's definition, `turnNode.shown(s)?.counts.roll`, e.g. in
   * an action's `validate`.
   */
  readonly shown: Record<string, unknown>;
  readonly vars: DeepReadonly<V>;
  /** The player the flow is bound to here: whose turn it is, or whose ability is running. */
  readonly actor: PlayerId | undefined;
  /** The zone's entities, top first, typed by what the zone holds. */
  entities<P>(zone: ZoneRef<P>): readonly Entity<P>[];
  count(zone: ZoneRef): number;
  /** A family's instances in seat order then index order; only `player`'s when given. */
  zones<P>(family: FamilyRef<P>, player?: PlayerId): ZoneRef<P>[];
  /** An entity by id. Throws on an unknown id. Narrow it with an entity type's `is` to type its props. */
  entity(id: EntityId): Entity;
}

export interface MoveOptions {
  /** The moved entities' `faceUp`. Omitted clears any override. Ignored in a "top" zone. */
  faceUp?: boolean;
  /** Where they land: on top (the default) or at the bottom, keeping their order. */
  at?: "top" | "bottom";
}

/**
 * A transaction: what steps, actions and effects change the game through.
 * Every change is logged as an event. In a transaction, an effect's scope
 * is a draft whose changes are kept when the transaction ends.
 */
export interface Tx<V> extends Scoped {
  readonly players: readonly PlayerId[];
  /** As `Reader.shown`. */
  readonly shown: Record<string, unknown>;
  vars: V;
  readonly actor: PlayerId | undefined;
  entities<P>(zone: ZoneRef<P>): readonly Entity<P>[];
  count(zone: ZoneRef): number;
  zones<P>(family: FamilyRef<P>, player?: PlayerId): ZoneRef<P>[];
  entity(id: EntityId): Entity;
  /** Removes an entity from the game. */
  destroy(id: EntityId): void;
  /** Changes some of an entity's props: `tx.update(d, { held: true })`. */
  update<P>(entity: Entity<P>, patch: Partial<P>): void;
  /** Creates an entity at the bottom of a zone that holds its type. */
  create<P>(type: TypeRef<P>, props: P, zone: ZoneRef<P>): EntityId;
  /** Moves entities to the top of `to`, keeping their order. */
  move(
    ids: EntityId | readonly EntityId[],
    to: ZoneRef,
    opts?: MoveOptions,
  ): void;
  /** Moves the top `count` (default 1) entities between zones holding the same type. Throws if there are fewer. */
  moveTop<P>(
    from: ZoneRef<P>,
    to: ZoneRef<P>,
    count?: number,
    opts?: MoveOptions,
  ): EntityId[];
  shuffle(zone: ZoneRef): void;
  flip(id: EntityId, faceUp: boolean): void;
  readonly random: Random;
  end(result?: unknown): void;
  /** Causes an effect: logged now, run (abilities before it, its resolution, abilities after it) once this transaction ends. */
  cause<T>(effect: EffectRef<T>, data: T): void;
}

export interface ActionImpl<V> {
  validate?(s: Reader<V>, args: unknown, actor: PlayerId): true | string;
  enumerate(s: Reader<V>, actor: PlayerId): unknown[];
  /** May return a result for the waiting kind's `answered`. */
  execute(tx: Tx<V>, args: unknown, actor: PlayerId): unknown;
}

export interface EffectImpl<V> {
  resolve?(tx: Tx<V>, data: unknown): void;
  to?(data: unknown): readonly PlayerId[];
}

export interface Impl<V> {
  setup(tx: Tx<V>): void;
  actions: Record<string, ActionImpl<V>>;
  /** A step may return `{ exit }` to raise an outcome. */
  steps: Record<string, (tx: Tx<V>) => unknown>;
  conditions: Record<string, (s: Reader<V>) => boolean>;
  /** Read-only functions of state that nodes consult, e.g. `turns.from`. */
  queries: Record<string, (s: Reader<V>) => unknown>;
  /** How many instances a counted zone has, from the player count. */
  zoneCounts: Record<string, (players: number) => number>;
  /** Each effect by name: how it resolves, and who sees it (everyone when absent). */
  effects: Record<string, EffectImpl<V>>;
  /** Whether an event fires an ability for `self`, which is already in its zone (none if game-wide). */
  abilities: Record<
    string,
    (s: Reader<V>, event: GameEvent<V>, self?: Entity) => boolean
  >;
  /** Who answers a game-wide ability, given the event that fired it. */
  abilityOwners: Record<
    string,
    (s: Reader<V>, event: GameEvent<V>) => PlayerId | undefined
  >;
}

/** What a kind tells the engine to do with the frame on top. */
export type Next = { pass: Node } | "done" | "wait" | Exit | Spawn;

/** Starts child fibers, each running `node` (for `player`, if given), and waits for all of them. */
export interface Spawn {
  spawn: { node: Node; player?: PlayerId }[];
}

/** Raises an outcome, which unwinds to the nearest frame that catches it. */
export interface Exit {
  exit: string;
}
export const isExit = (v: unknown): v is Exit =>
  typeof v === "object" &&
  v !== null &&
  "exit" in v &&
  typeof (v as Exit).exit === "string";

/** An action that was just applied, with what its `execute` returned. */
export interface Answer {
  player: PlayerId;
  action: string;
  args: unknown;
  result: unknown;
}

/** What a kind may read: the game, the state, and the game's conditions and queries. */
export interface ReadCtx<V> {
  readonly game: GameDef<V>;
  readonly state: State<V>;
  holds(condition: string): boolean;
  query(name: string): unknown;
}

export interface KindCtx<V> extends ReadCtx<V> {
  /** The state as the kind sees it; `transact` replaces it. */
  state: State<V>;
  transact<R>(body: (tx: Tx<V>) => R): R;
  /** Queues the abilities `event` fires at `timing`, to run above this frame. */
  fire(event: GameEvent, timing: "before" | "after"): void;
}

/** A node kind: how the engine runs nodes of this kind. Built-ins and custom kinds alike. */
/**
 * A node kind: how the engine runs nodes of this kind. Built-ins and custom
 * kinds alike. `S` is what it shows views, if anything (see `show`).
 */
export interface Kind<N extends Node = Node, S = unknown> {
  /** The node's child nodes, for indexing. */
  children(node: N): Node[];
  /**
   * Called whenever the node's frame is on top: on entry, and again each time
   * a child it passed to has ended. `frame.i` counts the passes so far.
   */
  run(node: N, frame: Frame, ctx: KindCtx<unknown>): Next;
  /**
   * What players may see of this frame, as JSON: published in views under
   * the kind's name (`view.shown.turn`), from the innermost such frame. Only
   * the root flow and the viewer's own fibers are shown. Unlike `scope`, it
   * goes to every player, so it must not hold hidden information.
   */
  show?(node: N, frame: Frame, ctx: ReadCtx<unknown>): S | undefined;
  /** For kinds that bind a player: whose turn it is while this frame is on the stack. */
  actor?(node: N, frame: Frame, ctx: ReadCtx<unknown>): PlayerId | undefined;
  /** For kinds that wait for input: the actions a player may take now. */
  actions?(node: N, frame: Frame, player: PlayerId): string[];
  /**
   * For kinds that wait on several players at once: who may act now. Without
   * it, the nearest frame that binds an `actor` decides, then the first seat.
   */
  actors?(node: N, frame: Frame, ctx: ReadCtx<unknown>): PlayerId[];
  /**
   * For kinds that wait: called after an action ran, with what `execute`
   * returned. "wait" keeps the frame waiting; "done" ends it. Default: done.
   */
  answered?(node: N, frame: Frame, answer: Answer, ctx: KindCtx<unknown>): Next;
  /** A guard: checked after every transaction, outermost frame first. An outcome name fires it. */
  check?(node: N, frame: Frame, ctx: KindCtx<unknown>): string | undefined;
  /** Whether this frame catches a raised outcome. */
  catches?(node: N, frame: Frame, outcome: string): boolean;
  /** What this frame shows the nodes under it, read with `s.scopeOf(node.id)`. */
  scope?(node: N, frame: Frame): unknown;
  /** Called on the catching frame once everything above it is cancelled. */
  exited?(node: N, frame: Frame, outcome: string, ctx: KindCtx<unknown>): Next;
}

export interface GameDef<V> {
  spec: Spec;
  impl: Impl<V>;
  kinds: Record<string, Kind>;
}

export interface Input {
  player: PlayerId;
  action: string;
  args: unknown;
}

// --- Events -----------------------------------------------------------------

/**
 * What one transaction did, in order. An event that touches an entity carries
 * the entity as it is afterwards (`E` is `Entity`, or in a view `Entity |
 * HiddenEntity`), so replaying is a fold and filtering is `canSee`.
 */
export type GameEvent<V = unknown, E = Entity> =
  /** Added at the bottom of its zone. */
  | { type: "created"; entity: E }
  /** Moved to the top of `to` (or its bottom), keeping their order; `from` is each one's old zone. */
  | {
      type: "moved";
      from: ZoneId[];
      to: ZoneId;
      at?: "bottom";
      entities: E[];
    }
  /** The zone's entities in their new order, top first, with new refs. */
  | { type: "shuffled"; zone: ZoneId; entities: E[] }
  | { type: "flipped"; entity: E }
  | { type: "updated"; entity: E }
  /** The entity as it was when destroyed. */
  | { type: "destroyed"; entity: E }
  /** The vars after the transaction, when it changed them. */
  | { type: "vars"; vars: V }
  /** A caused effect, logged when caused; `to` limits who sees it. */
  | { type: "effect"; name: string; data: unknown; to?: readonly PlayerId[] }
  | { type: "ended"; result: unknown }
  /**
   * What the flow waits on and what its kinds show changed, logged at the
   * end of an input. `fibers` holds what each stack shows, the root first;
   * a player's view gets only the root's and their own fibers', merged.
   */
  | { type: "flow"; waiting: Waiting[]; fibers: FiberShown[] };

/** What one stack's kinds show, and the player its fiber belongs to, if any. */
export interface FiberShown {
  player?: PlayerId;
  shown: Record<string, unknown>;
}

/** An event as a player may see it. */
export type ViewEvent<V = unknown> =
  | Exclude<GameEvent<V, Entity | HiddenEntity>, { type: "flow" }>
  /** The flow as this player sees it: replaces the view's `waiting` and `shown`. */
  | { type: "flow"; waiting: Waiting[]; shown: Record<string, unknown> };

export type Applied<V> =
  | { ok: true; state: State<V>; events: GameEvent<V>[] }
  | { ok: false; reason: string };

/** An entity a viewer can't see: where it is, and nothing that tells it apart. */
export interface HiddenEntity {
  readonly ref: Ref;
  readonly zone: ZoneId;
  readonly hidden: true;
}

/** The state as a player may see it. Entities and zone lists are keyed by `ref`. */
/** A prompt that's open, as players see it: who it waits on, and its label if it has one. */
export interface Waiting {
  label?: string;
  actors: PlayerId[];
}

/**
 * The state as a player may see it. Entities and zone lists are keyed by
 * `ref`. `waiting` and `shown` describe the flow; `flow` events carry their
 * changes, so `replay` rebuilds them too.
 */
export interface View<V> {
  player: PlayerId;
  /** Every seat, in order. */
  players: readonly PlayerId[];
  vars: V;
  zones: Record<ZoneId, Ref[]>;
  entities: Record<Ref, Entity | HiddenEntity>;
  status: "running" | "finished";
  result?: unknown;
  /** Every open prompt, in fiber order. */
  waiting: Waiting[];
  /** What kinds show players, by kind name: `turnNode.shown(view)` reads `shown.turn`. */
  shown: Record<string, unknown>;
}
