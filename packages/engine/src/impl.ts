import type { DeepReadonly, Json } from "./json.js";
import type { Tx } from "./tx.js";
import type {
  Entity,
  EntityId,
  GameState,
  NodeId,
  PlayerId,
  Scope,
  Zone,
  ZoneId,
} from "./types.js";

/** A read-only facade over state, for conditions, validators and lists. */
export interface StateReader<V extends Json = Json> {
  readonly state: DeepReadonly<GameState<V>>;
  readonly vars: DeepReadonly<V>;
  readonly players: readonly PlayerId[];
  zone(id: ZoneId): DeepReadonly<Zone>;
  entity(id: EntityId): DeepReadonly<Entity>;
  /** The zone's entities, top first. */
  entities(zoneId: ZoneId): DeepReadonly<Entity>[];
  top(zoneId: ZoneId): DeepReadonly<Entity> | undefined;
  count(zoneId: ZoneId): number;
  /** The nearest frame's locals, or a named enclosing frame's. */
  local<L = Json>(nodeId?: NodeId): DeepReadonly<L>;
}

// Handlers are declared with method syntax so their parameters are checked
// bivariantly: an action can annotate `args` with its own shape.

export interface ActionDef<V extends Json = Json, A = Json> {
  /** `true`, or a reason the action isn't allowed, shown to the player. */
  validate?(s: StateReader<V>, args: A, scope: Scope): true | string;
  execute(tx: Tx<V>, args: A): void;
  /** All legal args. Enables `legalInputs`, bots and fuzzing. */
  enumerate?(s: StateReader<V>, scope: Scope): A[];
}

export interface SetupContext {
  players: readonly PlayerId[];
  options: Json;
}

export interface GameImpl<V extends Json = Json> {
  /** Creates entities and sets vars. */
  setup(tx: Tx<V>, ctx: SetupContext): void;
  conditions?: { [name: string]: (s: StateReader<V>, scope: Scope) => boolean };
  steps?: { [name: string]: (tx: Tx<V>) => void };
  locals?: { [name: string]: (s: StateReader<V>, scope: Scope) => Json };
  /** `each` over refs, `choose` options and `{ ref }` actors. */
  lists?: { [name: string]: (s: StateReader<V>, scope: Scope) => Json[] };
  choices?: { [name: string]: (tx: Tx<V>, selection: Json[]) => void };
  actions?: { [name: string]: ActionDef<V, never> };
  /** Custom zone visibility refs. */
  visibility?: {
    [name: string]: (
      s: StateReader<V>,
      entity: Entity,
      viewer: PlayerId,
    ) => boolean;
  };
}

export const IMPL_CATEGORIES = [
  "conditions",
  "steps",
  "locals",
  "lists",
  "choices",
  "actions",
  "visibility",
] as const;
export type ImplCategory = (typeof IMPL_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Type-level ref collection. Every string ref in a spec becomes a tagged
// string like "steps:deal", so `defineGame` can require exactly the impl
// entries the spec uses.

type Str<T> = T extends string ? T : never;
type Tag<C extends ImplCategory, T> = `${C}:${Str<T>}`;
type ValuesOf<T> = T extends object ? T[keyof T] : never;

type OwnRefs<N> =
  | (N extends { locals: infer L } ? Tag<"locals", L> : never)
  | (N extends { exits: infer E } ? Tag<"conditions", ValuesOf<E>> : never)
  | (N extends { until: infer U } ? Tag<"conditions", U> : never)
  | (N extends { while: infer W } ? Tag<"conditions", W> : never)
  | (N extends { endWhen: infer W } ? Tag<"conditions", W> : never)
  | (N extends { kind: "branch"; cases: readonly (infer C)[] }
      ? C extends { when: infer W }
        ? Tag<"conditions", W>
        : never
      : never)
  | (N extends { kind: "step"; run: infer R } ? Tag<"steps", R> : never)
  | (N extends { kind: "decision"; actions: infer A }
      ? Tag<"actions", keyof A>
      : never)
  | (N extends { actor: { ref: infer R } } ? Tag<"lists", R> : never)
  | (N extends { over: { ref: infer R } } ? Tag<"lists", R> : never)
  | (N extends { over: { from: { ref: infer R } } } ? Tag<"lists", R> : never)
  | (N extends { kind: "choose"; options: infer O } ? Tag<"lists", O> : never)
  | (N extends { kind: "choose"; apply: infer A } ? Tag<"choices", A> : never);

type ChildNodes<N> =
  | (N extends { children: readonly (infer C)[] } ? C : never)
  | (N extends { body: infer B } ? B : never)
  | (N extends { cases: readonly (infer C)[] }
      ? C extends { then: infer T }
        ? T
        : never
      : never)
  | (N extends { else: infer E } ? E : never)
  | (N extends { kind: "decision"; actions: infer A }
      ? ValuesOf<A> extends infer X
        ? X extends { then: infer T }
          ? T
          : never
        : never
      : never)
  | (N extends { on: infer O } ? ValuesOf<O> : never);

type Depth = [
  never,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
];

type NodeRefs<N, D extends number = 19> = [D] extends [never]
  ? never
  : N extends unknown
    ? OwnRefs<N> | NodeRefs<ChildNodes<N>, Depth[D]>
    : never;

type TriggerRefs<T> = T extends {
  flow: infer F;
}
  ? NodeRefs<F> | (T extends { when: infer W } ? Tag<"conditions", W> : never)
  : never;

type ZoneRefs<Z> = Z extends { visibility: { ref: infer R } }
  ? Tag<"visibility", R>
  : never;

/** Every impl ref a spec uses, as tagged strings like `"steps:deal"`. */
export type SpecRefs<S> =
  | (S extends { flow: infer F } ? NodeRefs<F> : never)
  | (S extends { subflows: infer F } ? NodeRefs<ValuesOf<F>> : never)
  | (S extends { triggers: readonly (infer T)[] } ? TriggerRefs<T> : never)
  | (S extends { zones: infer Z } ? ZoneRefs<ValuesOf<Z>> : never);

/** The names a spec uses in one impl category. */
export type RefsIn<S, C extends ImplCategory> =
  SpecRefs<S> extends infer R
    ? R extends `${C}:${infer Name}`
      ? Name
      : never
    : never;

type RequiredEntries<S, I> = {
  [C in ImplCategory as [RefsIn<S, C>] extends [never] ? never : C]: {
    [Name in RefsIn<S, C>]: C extends keyof I
      ? Name extends keyof I[C]
        ? unknown
        : `Missing impl.${C}.${Name}`
      : `Missing impl.${C}.${Name}`;
  };
};

type NoUnusedEntries<S, I> = {
  [C in keyof I]: C extends ImplCategory
    ? {
        [Name in keyof I[C]]: Name extends RefsIn<S, C>
          ? unknown
          : `Unused impl.${C}.${Str<Name>}: the spec never references it`;
      }
    : unknown;
};

/**
 * Checks an impl against a spec: every ref the spec uses must exist, and
 * every impl entry must be used. Violations surface as type errors naming
 * the entry.
 */
export type CheckImpl<S, I> = RequiredEntries<S, I> & NoUnusedEntries<S, I>;

/** The vars type an impl was written for. */
export type VarsOf<I> = I extends {
  setup(tx: Tx<infer V>, ...rest: never[]): void;
}
  ? V
  : Json;
