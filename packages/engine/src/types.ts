import type { Patch } from "immer";
import type { Json } from "./json.js";
import type { RngState } from "./rng.js";

export type PlayerId = string;
export type EntityId = string;
/** "deck", or "hand:p2" for per-player zones (`<zoneName>:<playerId>`). */
export type ZoneId = string;
/** Unique within a game spec. */
export type NodeId = string;
export type FiberId = string;
export type PromptId = string;

export interface GameState<V extends Json = Json> {
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
  vars: V;
  entities: Record<EntityId, Entity>;
  zones: Record<ZoneId, Zone>;
  rng: RngState;
  flow: FlowState;
  status: "running" | "finished";
  /** Set by `tx.end(result)`. */
  result?: Json;
}

export interface Entity {
  /** `${type}#${n}`, with n from `meta.nextEntity`. */
  id: EntityId;
  type: string;
  props: Json;
  /** Back-reference to the entity's zone, kept consistent by ops. */
  zone: ZoneId;
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

export type GameEvent = { seq: number; input: number } & GameEventBody;

export type GameEventBody =
  | { type: "created"; id: EntityId; entity: Entity; at: number }
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
