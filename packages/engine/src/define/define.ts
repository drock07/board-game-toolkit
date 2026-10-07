// `define`: binds a game's vars and lowers its rules into a spec and impl.
import { GameDefinitionError, RulesError } from "../errors.js";
import * as kinds from "../kinds/index.js";
import type {
  AbilityNode,
  AbilityScope,
  ActionImpl,
  Entity,
  EntityId,
  GameEvent,
  Impl,
  Kind,
  PlayerId,
  ZoneDef,
} from "../types.js";
import type {
  AnyZone,
  Before,
  Effect,
  EntityType,
  ZoneFamily,
} from "./handles.js";
import {
  type Action,
  type ActionDef,
  type ActionLike,
  type Core,
  type Input,
  type Lowerer,
  type Node,
  type PlainActionDef,
  type Reader,
  type Scoped,
  type Trigger,
  type Tx,
} from "./types.js";

/** An effect's frame id, so an ability can read the data of the effect it reacts to. */
const effectNodeId = (name: string) => `effect.${name}`;

/** The running ability's scope, read through its node id. */
const abilityScope = (s: Scoped, id: string): AbilityScope => {
  const scope = s.scopeOf(id) as AbilityScope | undefined;
  if (!scope) throw new RulesError(`Not inside ability "${id}"`);
  return scope;
};

/** An effect's data, or undefined for an engine event. */
const dataOf = (e: GameEvent) => (e.type === "effect" ? e.data : undefined);

// --- define -----------------------------------------------------------------

export function define<V>(box: { zones?: AnyZone[] } = {}): Core<V> {
  const zones: Record<string, ZoneDef> = {};
  const zoneCounts: Record<string, (players: number) => number> = {};
  // Entity types by name: `is()` narrows by name, so a name means one type
  const types = new Map<string, EntityType<unknown>>();
  for (const z of box.zones ?? []) {
    if (zones[z.name])
      throw new GameDefinitionError(`Two zones are named "${z.name}"`);
    const known = types.get(z.holds.name);
    if (known && known !== z.holds)
      throw new GameDefinitionError(
        `Two different entity types are named "${z.holds.name}": declare it once and share the handle`,
      );
    types.set(z.holds.name, z.holds);
    zones[z.name] = z.def;
    if (z.countOf) zoneCounts[z.name] = z.countOf;
  }
  function action<N extends string, A>(
    name: N,
    def: PlainActionDef<V> | ActionDef<V, A>,
  ): Action<V, N, A | void> {
    const impl: ActionImpl<V> =
      "enumerate" in def
        ? def
        : {
            enumerate: () => [undefined],
            execute: (tx, _args, actor) => def.execute(tx, actor),
            ...(def.validate && {
              validate: (s: never, _args: unknown, actor: PlayerId) =>
                def.validate!(s, actor),
            }),
          };
    const by = (player: PlayerId, args?: A) => ({ player, action: name, args });
    return {
      name,
      by: by as never,
      is: (input): input is Input<N, A | void> => input.action === name,
      impl,
    };
  }
  // Every effect declared on this core; `rules` gives a game all of them
  const declared = new Map<string, Effect<V, unknown>>();
  const core: Core<V> = {
    action: action,
    effect<T>(
      name: string,
      def: {
        resolve?: (tx: Tx<V>, data: T) => void;
        to?: (data: T) => readonly PlayerId[];
      } = {},
    ) {
      if (declared.has(name))
        throw new GameDefinitionError(`Two effects are named "${name}"`);
      const e = { name, ...def } as Effect<V, T>;
      (e as { before: Before<V, T> }).before = { effect: e, timing: "before" };
      declared.set(name, e);
      return e;
    },
    ability(def: {
      of?: EntityType<unknown>;
      where?: (self: Entity) => boolean;
      in?: ZoneFamily<unknown>;
      on: Effect<V, unknown> | Before<V, unknown> | "enters";
      pause?: "everyone";
      who?: (s: Reader<V>, data: unknown) => PlayerId | undefined;
      when?: (s: Reader<V>, t: never) => boolean;
      then: (t: Trigger<never, never>) => Node<V, unknown>;
    }) {
      const carried = def.of !== undefined && def.in !== undefined;
      const owner = (self: Entity) =>
        def.in?.def.perPlayer ? self.zone.split(":")[1] : undefined;
      const on = def.on;
      const effect =
        on === "enters" ? undefined : "timing" in on ? on.effect : on;
      const timing = on !== "enters" && "timing" in on ? on.timing : "after";
      const label = def.of?.name ?? effect!.name;
      return {
        lower(l: Lowerer<V>) {
          const id = l.id(`ability.${label}`);
          const t = {
            self: (s: Scoped & { entity(id: EntityId): Entity }) =>
              s.entity(abilityScope(s, id).self!),
            owner: (s: Scoped) => abilityScope(s, id).owner,
            // An effect's data is the live one (a draft in a transaction)
            data: (s: Scoped) =>
              effect
                ? s.scopeOf(effectNodeId(effect.name))
                : dataOf(abilityScope(s, id).event),
          } as Trigger<never, never>;
          const node: AbilityNode = {
            kind: "ability",
            id,
            ...(carried && { of: def.of!.name, in: def.in!.name }),
            timing,
            ...(def.pause && { pause: def.pause }),
            body: l.visit(def.then(t)),
          };
          const matches = (s: never, ev: GameEvent, self?: Entity) => {
            const fired =
              on === "enters"
                ? (ev.type === "moved" &&
                    ev.entities.some((e) => e.id === self?.id)) ||
                  (ev.type === "created" && ev.entity.id === self?.id)
                : ev.type === "effect" && ev.name === effect!.name;
            if (!fired) return false;
            if (!carried) return !def.when || def.when(s, dataOf(ev) as never);
            if (def.where && !def.where(self!)) return false;
            return (
              !def.when ||
              def.when(s, {
                self: self!,
                owner: owner(self!),
                data: dataOf(ev),
              } as never)
            );
          };
          const who = def.who;
          return {
            node,
            matches,
            ...(effect && { effect }),
            ...(!carried &&
              who && {
                who: (s: never, ev: GameEvent) => who(s, dataOf(ev)),
              }),
          };
        },
      };
    },
    rules(def) {
      const p = def.players ?? 1;
      const [min, max] = typeof p === "number" ? [p, p] : p;
      if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 1 ||
        min > max
      )
        throw new GameDefinitionError(
          `players must be a whole number from 1, or [min, max] with min <= max; got ${JSON.stringify(p)}`,
        );
      const impl: Impl<V> = {
        setup: (tx) => def.setup(tx),
        actions: {},
        steps: {},
        conditions: {},
        queries: {},
        zoneCounts,
        abilities: {},
        abilityOwners: {},
        effects: {},
      };
      const handles = new Map<string, ActionLike<V>>();
      const used = new Set<string>();
      const modules: Record<string, Kind> = {};
      const register = (n: Node<V, unknown>) => {
        const spec = n.lower(l);
        const known = modules[spec.kind];
        if (known && known !== n.module)
          throw new GameDefinitionError(
            `Two different kinds are named "${spec.kind}"`,
          );
        modules[spec.kind] = n.module;
        return spec;
      };
      const l: Lowerer<V> = {
        id(kind) {
          let out = kind;
          for (let i = 2; used.has(out); i++) out = `${kind}${i}`;
          used.add(out);
          return out;
        },
        cond(name, fn) {
          impl.conditions[name] = fn;
          return name;
        },
        step(name, fn) {
          impl.steps[name] = fn;
          return name;
        },
        query(name, fn) {
          impl.queries[name] = fn;
          return name;
        },
        action(a) {
          if (handles.has(a.name) && handles.get(a.name) !== a)
            throw new GameDefinitionError(
              `Two different actions are named "${a.name}"`,
            );
          handles.set(a.name, a);
          impl.actions[a.name] = (a as unknown as { impl: ActionImpl<V> }).impl;
          return a.name;
        },
        visit: register,
      };
      const flow = register(def.flow);
      const caused = new Map<string, Effect<V, unknown>>();
      const addEffect = (e: Effect<V, unknown>) => {
        if (caused.has(e.name) && caused.get(e.name) !== e)
          throw new GameDefinitionError(
            `Two different effects are named "${e.name}"`,
          );
        caused.set(e.name, e);
      };
      for (const e of declared.values()) addEffect(e);
      const abilities = (def.abilities ?? []).map((a) => {
        const { node, matches, effect, who } = a.lower(l);
        if (node.in !== undefined) {
          const z = zones[node.in];
          if (!z)
            throw new GameDefinitionError(
              `Ability "${node.id}" is carried in zone "${node.in}", which isn't one of this game's zones`,
            );
          if (z.holds !== node.of)
            throw new GameDefinitionError(
              `Ability "${node.id}" is carried by "${node.of}", but zone "${node.in}" holds "${z.holds}"`,
            );
        }
        impl.abilities[node.id] = matches as never;
        if (who) impl.abilityOwners[node.id] = who as never;
        if (effect) addEffect(effect);
        return node;
      });
      const effects = [...caused.values()].map((e) => {
        impl.effects[e.name] = {
          ...(e.resolve && {
            resolve: (tx, data) => e.resolve!(tx, data),
          }),
          ...(e.to && { to: (data) => e.to!(data) }),
        };
        return {
          kind: "effect" as const,
          id: l.id(effectNodeId(e.name)),
          name: e.name,
        };
      });
      if (abilities.length) modules.ability = kinds.ability;
      if (effects.length) modules.effect = kinds.effect;
      return {
        spec: {
          players: { min, max },
          zones,
          flow,
          ...(abilities.length && { abilities }),
          ...(effects.length && { effects }),
        },
        impl,
        kinds: modules,
        action: (name) => handles.get(name) as never,
      };
    },
    withNodes(defs) {
      const out: Record<string, unknown> = { ...core };
      for (const d of defs) out[d.name] = d.build;
      return out as never;
    },
  };
  return core;
}
