// The typed authoring layer: readers and transactions, actions, authored
// nodes, games, the node-builder registry, abilities and `Core`.
import type {
  AbilityNode,
  ActionImpl,
  Entity,
  EntityId,
  Exit,
  GameDef,
  GameEvent,
  Kind,
  PlayerId,
  Reader,
  Scoped,
  Node as SpecNode,
  Tx,
} from "../types.js";
import type { Before, Effect, EntityType, ZoneFamily } from "./handles.js";

// --- Typed state access ----------------------------------------------------

// One `Reader` and one `Tx`: the engine's, which are typed by the handles
export type { Reader, Scoped, Tx };

// --- Actions ----------------------------------------------------------------

export interface Input<N extends string, A> {
  player: PlayerId;
  action: N;
  args: A;
}

type By<N extends string, A> = [A] extends [void]
  ? (player: PlayerId) => Input<N, void>
  : (player: PlayerId, args: A) => Input<N, A>;

/** A named action. Get one back from a game with `game.action(name)`. */
export interface Action<V, N extends string, A> {
  readonly name: N;
  /** The input that plays this action, by `player`. */
  readonly by: By<N, A>;
  /** Narrows an input to this action, so its args are typed. */
  readonly is: (input: { action: string }) => input is Input<N, A>;
  readonly impl: ActionImpl<V>;
  readonly __vars?: V;
}

/** What `execute` may return: a result for the node that holds the prompt. */
export type ActionResult = void | "end" | Exit;

/** An action without arguments. */
export interface PlainActionDef<V> {
  validate?(s: Reader<V>, actor: PlayerId): true | string;
  execute(tx: Tx<V>, actor: PlayerId): ActionResult;
}

/** An action with arguments, typed by what `enumerate` returns. */
export interface ActionDef<V, A> {
  enumerate(s: Reader<V>, actor: PlayerId): A[];
  validate?(s: Reader<V>, args: A, actor: PlayerId): true | string;
  execute(tx: Tx<V>, args: A, actor: PlayerId): ActionResult;
}

/**
 * What a prompt needs from an action. Deliberately minimal: using the full
 * `Action` here would contextually type inline `action(...)` calls through
 * `by`'s conditional type and break their args inference.
 */
export type ActionLike<V> = { readonly name: string; readonly __vars?: V };

// --- Authored flow ----------------------------------------------------------

/** What a node's `lower` may use to produce its spec node and impl entries. */
export interface Lowerer<V> {
  /** A unique node id: the kind's name, numbered when repeated. */
  id(kind: string): string;
  /** Registers a condition under `name` and returns the name. */
  cond(name: string, fn: (s: Reader<V>) => boolean): string;
  /** Registers a step under `name` and returns the name. */
  step(name: string, fn: (tx: Tx<V>) => void): string;
  /** Registers a read-only query under `name` and returns the name. */
  query(name: string, fn: (s: Reader<V>) => unknown): string;
  /** Registers an action handle and returns its name. */
  action(handle: ActionLike<V>): string;
  readonly visit: (child: Node<V, unknown>) => SpecNode;
}

/**
 * An authored node: its kind module, the actions inside (phantom), and how
 * to lower it. `rules` collects every node's module into the game's kinds.
 */
export interface Node<V, H> {
  readonly module: Kind;
  readonly __actions?: H;
  lower(l: Lowerer<V>): SpecNode;
}

/** The action handles inside a node, from its phantom. */
export type ActionsIn<N> = N extends { readonly __actions?: infer H }
  ? Exclude<H, undefined>
  : never;

/**
 * Makes an authored node. For kind authors. Returns `Node<V, never>`, which
 * fits any `Node<V, H>`; the builder's declared type supplies `H`.
 */
export const node = <V>(
  module: Kind<never>,
  lower: (l: Lowerer<V>) => SpecNode,
): Node<V, never> => ({
  module: module,
  lower,
});

export interface Game<V, H> extends GameDef<V> {
  /** The typed handle of one of the game's actions. */
  readonly action: <N extends NameOf<H>>(name: N) => Extract<H, { name: N }>;
  readonly __actions?: H;
}

type NameOf<H> = H extends { name: infer N extends string } ? N : never;
export type InputOf<H> =
  H extends Action<infer _V, infer N, infer A> ? Input<N, A> : never;
export type GameInput<G> =
  G extends Game<infer _V, infer H> ? InputOf<H> : never;

// --- Node definitions -------------------------------------------------------

/**
 * The registry of node builders by kind name, each a generic alias over the
 * game's vars. A kind adds itself with one augmentation:
 *
 *     declare module "../define/types.js" { interface NodeBuilders<V> { turn: TurnBuilder<V> } }
 *
 * `withNodes` reads a game's builders out of it; `defineNode` checks a kind's
 * implementation against it with `unknown` vars. This is the one place
 * TypeScript needs help: it can't produce a vars-bound builder type from a
 * generic function value, so the registry declares it instead.
 */
export interface NodeBuilders<V> {
  readonly __vars?: V;
}

export type KindName = Exclude<keyof NodeBuilders<unknown>, "__vars">;

/**
 * A node builder by name. The nodes it builds carry their kind modules
 * (`node(kind, lower)`), so a builder may also be shorthand that composes
 * other builders, with no kind of its own. The builder is checked with
 * `unknown` vars: it only moves functions into the impl and never looks
 * inside them, so that check holds for every game.
 */
export interface NodeDef<N extends KindName> {
  readonly name: N;
  readonly build: NodeBuilders<unknown>[N];
}

/**
 * Defines a node builder: `defineNode("turn", { build })`. The name is a
 * separate argument so it's inferred before `build` is checked against the
 * registry's type.
 */
export function defineNode<N extends KindName>(
  name: N,
  def: { build: NodeBuilders<unknown>[N] },
): NodeDef<N> {
  return { name, build: def.build };
}

/** The builders a list of definitions gives, by name, bound to `V`. */
export type Extended<V, Ds extends readonly NodeDef<KindName>[]> = {
  [D in Ds[number] as D["name"]]: NodeBuilders<V>[D["name"]];
};

// --- Abilities --------------------------------------------------------------

/** What fired an ability: its entity, the entity's owner, and the event's data. */
export interface Fired<P, T> {
  self: Entity<P>;
  owner: PlayerId | undefined;
  data: T;
}

/** Reads the running ability's `Fired` from any reader or transaction inside its handler. */
export interface Trigger<P, T> {
  readonly self: (s: Scoped & { entity(id: EntityId): Entity }) => Entity<P>;
  readonly owner: (s: Scoped) => PlayerId | undefined;
  /** An effect's data is live, and in a transaction a draft whose changes are kept. */
  readonly data: (s: Scoped) => T;
}

/** An authored ability: lowered by `rules` next to the flow. */
export interface Ability<V, A> {
  readonly __actions?: A;
  lower(l: Lowerer<V>): {
    node: AbilityNode;
    matches: (s: never, event: GameEvent, self: Entity) => boolean;
    /** The effect it reacts to, if `on` is one. */
    effect?: Effect<V, unknown>;
    /** A game-wide ability's `who`. */
    who?: (s: never, event: GameEvent) => PlayerId | undefined;
  };
}

/** What `define` gives: the game's types, `action`, `rules`, and `withNodes` for node kinds. */
export interface Core<V> {
  readonly __vars?: V;
  // The args overload must come first: overload resolution skips lambdas on
  // its first pass, so a def with `enumerate` would otherwise match the plain
  // overload and have `execute`'s parameters fixed as (tx, actor).
  readonly action: {
    <N extends string, A>(name: N, def: ActionDef<V, A>): Action<V, N, A>;
    <N extends string>(name: N, def: PlainActionDef<V>): Action<V, N, void>;
  };
  // The abilities are inferred as a tuple: one type parameter for their
  // actions would be fixed by the first ability and reject the rest
  readonly rules: <
    H extends ActionLike<V>,
    const As extends readonly Ability<V, unknown>[] = [],
  >(def: {
    players?: number | [number, number];
    setup(tx: Tx<V>): void;
    flow: Node<V, H>;
    abilities?: As;
  }) => Game<V, H | ActionsIn<As[number]>>;
  /**
   * An effect, with how it resolves and who sees it:
   * `effect("damage", { resolve: (tx, d: Damage) => ... })`. A game gets
   * every effect declared before its `rules`.
   */
  readonly effect: <T>(
    name: string,
    def?: {
      resolve?: (tx: Tx<V>, data: T) => void;
      /** Who sees it in their events; everyone when absent. */
      to?: (data: T) => readonly PlayerId[];
    },
  ) => Effect<V, T>;
  readonly ability: {
    /**
     * An ability of entities of type `of` (narrowed by `where`), live while
     * one is in a zone of family `in`. It fires on `on`: an effect (after it
     * resolves), an effect's `.before` (before it resolves, and may change
     * its data), or `"enters"` (this entity arrived in its zone), when `when` holds, both when the event
     * happens and again when the ability's turn comes. `then` builds the
     * handler from `t`, which reads the running ability's entity, owner and
     * event data; an effect's data is live, and changes to it in a
     * transaction are kept. `pause: "everyone"` holds every other fiber while
     * it runs.
     */
    <P, T = void, A = never>(def: {
      of: EntityType<P>;
      where?: (self: Entity<P>) => boolean;
      in: ZoneFamily<P>;
      on: Effect<V, T> | Before<V, T> | "enters";
      pause?: "everyone";
      when?: (s: Reader<V>, t: Fired<P, T>) => boolean;
      then: (t: Trigger<P, T>) => Node<V, A>;
    }): Ability<V, A>;
    /**
     * A game-wide ability: a rule, carried by no entity. `who` answers its
     * prompts (none binds no one). Use it for a reaction that must not depend
     * on hidden cards, e.g. always asking an Attack's target.
     */
    <T, A = never>(def: {
      on: Effect<V, T> | Before<V, T>;
      pause?: "everyone";
      who?: (s: Reader<V>, data: T) => PlayerId | undefined;
      when?: (s: Reader<V>, data: T) => boolean;
      then: (t: Trigger<never, T>) => Node<V, A>;
    }): Ability<V, A>;
  };
  /** Adds node builders, bound to this game's types: `withNodes([...defaultNodes, turnNode])`. */
  readonly withNodes: <const Ds extends readonly NodeDef<KindName>[]>(
    defs: Ds,
  ) => Core<V> & Extended<V, Ds>;
}

// --- The built-in node kinds -------------------------------------------------

export type SeqBuilder<V> = <const C extends Node<V, ActionLike<V>>[]>(
  ...children: C
) => Node<V, ActionsIn<C[number]>>;
/** A step may return `{ exit: outcome }` to raise an outcome. */
export type StepBuilder<V> = (
  run: (tx: Tx<V>) => void | Exit,
) => Node<V, never>;
/** Players take turns at `body`, until `until` holds or `rounds` passes are done. */
export type TurnsBuilder<V> = <H>(
  opts: {
    order?: "clockwise" | "counterclockwise";
    until?: (s: Reader<V>) => boolean;
    rounds?: number;
    /** The player who takes the first turn. Defaults to the first seat. */
    from?: (s: Reader<V>) => PlayerId;
    /** Who may take a turn now; the others are skipped. Defaults to everyone. */
    among?: (s: Reader<V>) => readonly PlayerId[];
  },
  body: Node<V, H>,
) => Node<V, H>;
/** Repeats `body` until `until` holds (forever when absent), checked before each pass. */
export type LoopBuilder<V> = <H>(
  opts: { until?: (s: Reader<V>) => boolean },
  body: Node<V, H>,
) => Node<V, H>;
/** Waits for the current player to take one of the actions. */
export type PromptBuilder<V> = <const H extends ActionLike<V>[]>(
  ...actions: H
) => Node<V, H[number]>;
/** Runs `body` once per player, all at once, each on its own fiber. */
export type SimultaneousBuilder<V> = <H>(body: Node<V, H>) => Node<V, H>;
/** Waits for every player to take one of the actions, in any order, once each. */
export type EveryoneBuilder<V> = <const H extends ActionLike<V>[]>(
  ...actions: H
) => Node<V, H[number]>;
/** Waits for the first answer from any of `who` (every player when absent). */
export type AnyoneBuilder<V> = <const H extends ActionLike<V>[]>(
  opts: { who?: (s: Reader<V>) => PlayerId[] },
  ...actions: H
) => Node<V, H[number]>;
/** Runs the first case whose condition holds, or `otherwise`. */
export type BranchBuilder<V> = <
  const C extends { when: (s: Reader<V>) => boolean; then: Node<V, unknown> }[],
  E extends Node<V, unknown> | undefined = undefined,
>(
  cases: C,
  otherwise?: E,
) => Node<V, ActionsIn<C[number]["then"]> | ActionsIn<E>>;
/**
 * The ways `body` may end early: each outcome has an optional guard `when`
 * (checked after every transaction) and an optional handler `then`. Any
 * outcome may also be raised from inside by returning `{ exit: name }`.
 */
export type OutcomesBuilder<V> = <
  const O extends Record<
    string,
    { when?: (s: Reader<V>) => boolean; then?: Node<V, unknown> }
  >,
  H,
>(
  outcomes: O,
  body: Node<V, H>,
) => Node<V, H | ActionsIn<O[keyof O]["then"]>>;

export interface NodeBuilders<V> {
  seq: SeqBuilder<V>;
  step: StepBuilder<V>;
  turns: TurnsBuilder<V>;
  loop: LoopBuilder<V>;
  branch: BranchBuilder<V>;
  outcomes: OutcomesBuilder<V>;
  prompt: PromptBuilder<V>;
  everyone: EveryoneBuilder<V>;
  anyone: AnyoneBuilder<V>;
  simultaneous: SimultaneousBuilder<V>;
}
