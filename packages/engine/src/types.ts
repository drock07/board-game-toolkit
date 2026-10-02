import type { Patch } from "immer";
import type { DeepReadonly, Json } from "./json.js";
import type { RngState } from "./rng.js";

export type PlayerId = string;
export type EntityId = string;
/** "deck", or "hand:p2" for per-player zones (`<zoneName>:<playerId>`). */
export type ZoneId = string;
/** Unique within a game spec. */
export type NodeId = string;
export type FiberId = string;
export type PromptId = string;

/**
 * A game's types in one bundle. Build it with `TypesFor<typeof spec, {...}>`,
 * which reads the zone names from the spec and checks the rest is JSON.
 */
export interface GameTypes {
  vars: unknown;
  /** Entity type → props. */
  entities: object;
  /** Zone definition names, split by whether they're per-player. */
  zones: { shared: string; perPlayer: string };
  /** Node id → that node's locals. Optional; untyped nodes stay `Json`. */
  locals: object;
}

/** The untyped bundle: what the engine sees internally. */
export interface AnyTypes extends GameTypes {
  vars: Json;
  entities: Record<string, Json>;
  zones: { shared: string; perPlayer: string };
  locals: Record<string, Json>;
}

/** A zone id: a shared zone's name, or `<name>:<playerId>` for per-player zones. */
export type ZoneIdOf<T extends GameTypes> =
  | T["zones"]["shared"]
  | `${T["zones"]["perPlayer"]}:${PlayerId}`;

export type EntityTypeOf<T extends GameTypes> = keyof T["entities"] & string;

/** An entity of the game, as a union over its entity types, so narrowing on `type` narrows `props`. */
export type EntityOf<T extends GameTypes> = {
  [K in EntityTypeOf<T>]: Entity<
    K,
    T["entities"][K & keyof T["entities"]],
    ZoneIdOf<T>
  >;
}[EntityTypeOf<T>];

/** Zones by id: shared zones are always present; per-player ones by pattern. */
export type ZonesOf<T extends GameTypes> = string extends T["zones"]["shared"]
  ? Record<ZoneId, Zone>
  : { [K in T["zones"]["shared"]]: Zone } & {
      [K in `${T["zones"]["perPlayer"]}:${PlayerId}`]: Zone;
    };

export interface GameState<T extends GameTypes = AnyTypes> {
  meta: {
    /** Spec id. */
    game: string;
    /** `spec.version`, so saves from an incompatible spec are rejected. */
    specVersion: number;
    /** Number of inputs applied so far. */
    inputCount: number;
    /** Monotonic; the next event's `seq`. */
    eventCount: number;
    /** Deterministic entity id counter. */
    nextEntity: number;
  };
  /** Seating order. */
  players: PlayerId[];
  vars: T["vars"];
  entities: Record<EntityId, EntityOf<T>>;
  zones: ZonesOf<T>;
  rng: RngState;
  flow: FlowState;
  status: "running" | "finished";
  /** Set by `tx.end(result)`. */
  result?: Json;
}

/**
 * A state as the engine hands it out. States share unchanged parts with the
 * states before them, so they must never be mutated; this type enforces it.
 */
export type ReadonlyGameState<T extends GameTypes = AnyTypes> = DeepReadonly<
  GameState<T>
> & {
  /** Phantom: keeps `T` inferable, which `DeepReadonly` alone loses. */
  readonly __types?: T;
};

export interface Entity<
  Type extends string = string,
  Props = Json,
  Z extends string = ZoneId,
> {
  /** `${type}#${n}`, with n from `meta.nextEntity`. */
  id: EntityId;
  type: Type;
  props: Props;
  /** Back-reference to the entity's zone, kept consistent by ops. */
  zone: Z;
  /** Overrides zone visibility for this entity when set. */
  faceUp?: boolean;
}

export interface Zone {
  id: ZoneId;
  /** Zone definition name in the spec. */
  def: string;
  /** Set for per-player zones. */
  owner?: PlayerId;
  /** Ordered: index 0 is the top. */
  items: EntityId[];
}

/** Where to insert into a zone. A number is an index from the top. */
export type Position = "top" | "bottom" | number;

export type GameEvent<T extends GameTypes = AnyTypes> = {
  seq: number;
  input: number;
} & GameEventBody<T>;

export type GameEventBody<T extends GameTypes = AnyTypes> =
  | { type: "created"; id: EntityId; entity: EntityOf<T>; at: number }
  | {
      type: "moved";
      ids: EntityId[];
      /** Source zone of each id, in the same order as `ids`. */
      from: ZoneId[];
      to: ZoneId;
      /** Index in `to` where the moved block starts. */
      at: number;
      /** The entities' `faceUp` after the move; absent clears it. */
      faceUp?: boolean;
    }
  /** `order` is the resulting order. */
  | { type: "shuffled"; zone: ZoneId; order: EntityId[] }
  | { type: "flipped"; id: EntityId; faceUp: boolean }
  | { type: "destroyed"; id: EntityId; from: ZoneId }
  /** Immer patches against `vars`, one event per transaction commit. */
  | { type: "vars"; patches: Patch[] }
  /** Immer patches against a frame's locals. */
  | { type: "locals"; node: NodeId; patches: Patch[] }
  | {
      type: "custom";
      name: string;
      payload: Json;
      visibleTo: PlayerId[] | "all";
    }
  | {
      type: "flow";
      kind: "enter" | "exit" | "prompt" | "resolve";
      node: NodeId;
      outcome?: string;
    }
  | { type: "ended"; result: Json };

export type GameEventType = GameEventBody["type"];

// ---------------------------------------------------------------------------
// Flow runtime state (section 8.1)

export interface FlowState {
  fibers: Record<FiberId, Fiber>;
  rootFiber: FiberId;
  nextFiberId: number;
  nextPromptId: number;
}

export interface Fiber {
  id: FiberId;
  /** Set when spawned by a parallel frame. */
  parent?: { fiber: FiberId; frame: number };
  /** `[0]` is the outermost frame. */
  stack: Frame[];
  status: "runnable" | "blocked" | "done";
  outcome?: string;
}

export interface Binding {
  player?: PlayerId;
  item?: Json;
  iteration?: number;
}

export interface Frame {
  node: NodeId;
  /** "handling" means the frame is running an `on` flow. */
  phase: "new" | "active" | "handling";
  binding?: Binding;
  locals?: Json;
  /** Node-kind private state: child index, loop count, child fiber ids. */
  data: Json;
  /** Set while blocked. */
  prompt?: Prompt;
  /** The node's pending `Next`, applied on the fiber's next step. */
  next?: Json;
  /** Set on an interrupt frame (a trigger flow), with the trigger id. */
  trigger?: string;
  /** The event that fired the trigger, for `scope.event`. */
  event?: GameEvent;
}

// ---------------------------------------------------------------------------
// Prompts and inputs (section 8.5)

export interface Prompt {
  /** `q${nextPromptId}`, unique for the life of the game. */
  id: PromptId;
  node: NodeId;
  kind: "decision" | "choose" | "pause";
  actors: PlayerId[];
  /** Decision actions. */
  actions?: { name: string; ends: boolean }[];
  /** Choose options. */
  options?: Json[];
  min?: number;
  max?: number;
  label?: string;
}

export type Input =
  | { prompt: PromptId; player: PlayerId; action: string; args?: Json }
  | { prompt: PromptId; player: PlayerId; choose: Json[] }
  | { prompt: PromptId; player: PlayerId; continue: true };

// ---------------------------------------------------------------------------
// Scope (section 7.5)

export interface Scope {
  /** Nearest each-over-players binding. */
  player?: PlayerId;
  /** Nearest each-over-ref binding. */
  item?: Json;
  /** Nearest loop's iteration index. */
  iteration?: number;
  /** The player whose input is being processed (actions, choices). */
  actor?: PlayerId;
  /** In trigger `when` conditions and trigger flows. */
  event?: GameEvent;
}
