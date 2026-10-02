import type {
  DeepReadonly,
  IsJsonCompatible,
  Json,
  JsonCompatible,
} from "./json.js";
import type { Tx } from "./tx.js";
import type {
  AnyTypes,
  Entity,
  EntityId,
  EntityOf,
  GameTypes,
  PlayerId,
  ReadonlyGameState,
  Scope,
  Zone,
  ZoneIdOf,
} from "./types.js";

/** A read-only facade over state, for conditions, validators and lists. */
export interface StateReader<T extends GameTypes = AnyTypes> {
  readonly state: ReadonlyGameState<T>;
  readonly vars: DeepReadonly<T["vars"]>;
  readonly players: readonly PlayerId[];
  zone(id: ZoneIdOf<T>): DeepReadonly<Zone>;
  entity(id: EntityId): DeepReadonly<EntityOf<T>>;
  /** The zone's entities, top first. */
  entities(zoneId: ZoneIdOf<T>): DeepReadonly<EntityOf<T>>[];
  top(zoneId: ZoneIdOf<T>): DeepReadonly<EntityOf<T>> | undefined;
  count(zoneId: ZoneIdOf<T>): number;
  /** A named enclosing frame's locals, typed by the bundle's `locals`. */
  local<N extends keyof T["locals"] & string>(
    nodeId: N,
  ): DeepReadonly<T["locals"][N]>;
  /** The nearest frame's locals, untyped. */
  local<L = Json>(): DeepReadonly<L>;
}

// Handlers are declared with method syntax so their parameters are checked
// bivariantly: an action can annotate `args` with its own shape.

export interface ActionDef<T extends GameTypes = AnyTypes, A = Json> {
  /** `true`, or a reason the action isn't allowed, shown to the player. */
  validate?(s: StateReader<T>, args: A, scope: Scope): true | string;
  execute(tx: Tx<T>, args: A): void;
  /** All legal args. Enables `legalInputs`, bots and fuzzing. */
  enumerate?(s: StateReader<T>, scope: Scope): A[];
}

export interface SetupContext {
  players: readonly PlayerId[];
  options: Json;
}

/** What a locals initializer may return: a declared locals shape, or JSON. */
type LocalsValue<T extends GameTypes> = [keyof T["locals"]] extends [never]
  ? Json
  : T["locals"][keyof T["locals"]] | Json;

export interface GameImpl<T extends GameTypes = AnyTypes> {
  /** Creates entities and sets vars. */
  setup(tx: Tx<T>, ctx: SetupContext): void;
  conditions?: { [name: string]: (s: StateReader<T>, scope: Scope) => boolean };
  steps?: { [name: string]: (tx: Tx<T>) => void };
  locals?: {
    [name: string]: (s: StateReader<T>, scope: Scope) => LocalsValue<T>;
  };
  /** `each` over refs, `choose` options and `{ ref }` actors. */
  lists?: { [name: string]: (s: StateReader<T>, scope: Scope) => Json[] };
  choices?: { [name: string]: (tx: Tx<T>, selection: Json[]) => void };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each action picks its own args type
  actions?: { [name: string]: ActionDef<T, any> };
  /** Custom zone visibility refs. */
  visibility?: {
    [name: string]: (
      s: StateReader<T>,
      entity: Entity,
      viewer: PlayerId,
    ) => boolean;
  };
}

// ---------------------------------------------------------------------------
// Building a game's type bundle

type ZoneDefsOf<S> = S extends { zones: infer Z } ? Z : never;

/** The zone names a spec declares, split by `perPlayer`. */
export type SpecZones<S> = {
  shared: {
    [K in keyof ZoneDefsOf<S>]: ZoneDefsOf<S>[K] extends { perPlayer: true }
      ? never
      : K;
  }[keyof ZoneDefsOf<S>] &
    string;
  perPlayer: {
    [K in keyof ZoneDefsOf<S>]: ZoneDefsOf<S>[K] extends { perPlayer: true }
      ? K
      : never;
  }[keyof ZoneDefsOf<S>] &
    string;
};

/** What a game declares about its types. Every part must be JSON-compatible. */
export interface TypeDecl {
  vars?: unknown;
  /** Entity type → props. */
  entities?: object;
  /** Node id → locals. */
  locals?: object;
}

/** Each declared part, with anything that isn't JSON mapped to `never`. */
export type CheckedDecl<D> = {
  [K in keyof D]: K extends "vars"
    ? JsonCompatible<D[K]>
    : K extends "entities" | "locals"
      ? { [E in keyof D[K]]: JsonCompatible<D[K][E]> }
      : never;
};

/**
 * A game's type bundle: zone names from the spec, plus declared vars, entity
 * props and locals. Declaring something that isn't JSON is a type error here.
 *
 * ```ts
 * type Types = TypesFor<typeof spec, { vars: Vars; entities: { card: Card } }>;
 * export const impl = { ... } satisfies GameImpl<Types>;
 * ```
 */
export type TypesFor<S, D extends TypeDecl & CheckedDecl<D> = object> = {
  vars: D extends { vars: infer V } ? V : Record<string, never>;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no entity types declared
  entities: D extends { entities: infer E } ? E : {};
  zones: SpecZones<S>;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no locals declared
  locals: D extends { locals: infer L } ? L : {};
};

/** The bundle an impl was written for, read from its `setup`'s `tx`. */
export type TypesOf<I> = I extends {
  setup(tx: infer X, ...rest: never[]): void;
}
  ? X extends { readonly __types?: infer T }
    ? NonNullable<T> extends GameTypes
      ? NonNullable<T>
      : AnyTypes
    : AnyTypes
  : AnyTypes;

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

/**
 * The impl's bundle must be JSON-compatible. `TypesFor` already checks this;
 * this catches bundles written by hand.
 */
export type CheckTypes<I> =
  AllJson<TypesOf<I>> extends true
    ? unknown
    : {
        "Game types must be JSON-compatible (vars, entity props and locals)": never;
      };

// Checked part by part: wrapping the parts in one object type made the check
// resolve as compatible inside generic aliases
type AllJson<T extends GameTypes> =
  IsJsonCompatible<T["vars"]> extends true
    ? IsJsonCompatible<T["entities"]> extends true
      ? IsJsonCompatible<T["locals"]>
      : false
    : false;
