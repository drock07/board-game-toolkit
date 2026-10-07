// `define`: binds a game's vars and lowers its rules into a spec and impl.
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
import {
  type AnyZone,
  type Effect,
  type EntityType,
  type EventType,
  type ZoneFamily,
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
  type Trigger,
} from "./types.js";

const scopeIn = (s: object): AbilityScope => {
  const scope = (s as { scope?: AbilityScope }).scope;
  if (!scope) throw new Error("Not inside an ability");
  return scope;
};

/** The data of a custom event, or undefined for an engine event. */
const dataOf = (e: GameEvent) => (e.type === "custom" ? e.data : undefined);

// --- define -----------------------------------------------------------------

export function define<V>(box: { zones?: AnyZone[] } = {}): Core<V> {
  const zones: Record<string, ZoneDef> = {};
  const zoneCounts: Record<string, (players: number) => number> = {};
  for (const z of box.zones ?? []) {
    if (zones[z.name]) throw new Error(`Two zones are named "${z.name}"`);
    zones[z.name] = z.def;
    if (z.countOf) zoneCounts[z.name] = z.countOf;
  }
  function action<N extends string, A>(
    name: N,
    def: PlainActionDef<V> | ActionDef<V, A>,
  ): Action<V, N, A | void> {
    const impl: ActionImpl<V> =
      "enumerate" in def
        ? (def as never)
        : {
            enumerate: () => [undefined],
            execute: (tx, _args, actor) => def.execute(tx as never, actor),
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
  const core: Core<V> = {
    action: action,
    effect: (name, def) => ({ name, effect: true, ...def }) as never,
    ability(def: {
      of?: EntityType<unknown>;
      where?: (self: Entity) => boolean;
      in?: ZoneFamily<unknown>;
      on: EventType<unknown> | "enters";
      timing?: "before" | "after";
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
        on !== "enters" && "effect" in on
          ? (on as Effect<V, unknown>)
          : undefined;
      const label = def.of?.name ?? (on as EventType<unknown>).name;
      if (def.timing === "before" && !effect)
        throw new Error(
          `An ability "${label}" reacts "before" something that isn't an effect`,
        );
      return {
        lower(l: Lowerer<V>) {
          const id = l.id(`ability.${label}`);
          const t = {
            self: (s: { entity(id: EntityId): Entity }) =>
              s.entity(scopeIn(s).self!),
            owner: (s: object) => scopeIn(s).owner,
            // An effect's data is the live one (a draft in a transaction)
            data: (s: object) =>
              effect
                ? (s as { effect: unknown }).effect
                : dataOf(scopeIn(s).event),
          } as Trigger<never, never>;
          const node: AbilityNode = {
            kind: "ability",
            id,
            ...(carried && { of: def.of!.name, in: def.in!.name }),
            timing: def.timing ?? "after",
            ...(def.pause && { pause: def.pause }),
            body: l.visit(def.then(t)),
          };
          const matches = (s: never, ev: GameEvent, self?: Entity) => {
            const fired =
              on === "enters"
                ? (ev.type === "moved" &&
                    ev.entities.some((e) => e.id === self?.id)) ||
                  (ev.type === "created" && ev.entity.id === self?.id)
                : ev.type === "custom" && ev.name === on.name;
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
      const impl: Impl<V> = {
        setup: (tx) => def.setup(tx as never),
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
          throw new Error(`Two different kinds are named "${spec.kind}"`);
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
          impl.conditions[name] = fn as never;
          return name;
        },
        step(name, fn) {
          impl.steps[name] = fn as never;
          return name;
        },
        query(name, fn) {
          impl.queries[name] = fn as never;
          return name;
        },
        action(a) {
          if (handles.has(a.name) && handles.get(a.name) !== a)
            throw new Error(`Two different actions are named "${a.name}"`);
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
          throw new Error(`Two different effects are named "${e.name}"`);
        caused.set(e.name, e);
      };
      for (const e of def.effects ?? []) addEffect(e);
      const abilities = (def.abilities ?? []).map((a) => {
        const { node, matches, effect, who } = a.lower(l);
        impl.abilities[node.id] = matches as never;
        if (who) impl.abilityOwners[node.id] = who as never;
        if (effect) addEffect(effect);
        return node;
      });
      const effects = [...caused.values()].map((e) => {
        impl.effects[e.name] = (tx, data) => e.resolve?.(tx as never, data);
        return {
          kind: "effect" as const,
          id: l.id(`effect.${e.name}`),
          name: e.name,
        };
      });
      if (abilities.length) modules.ability = kinds.ability;
      if (effects.length) modules.effect = kinds.effect;
      return {
        spec: {
          players:
            typeof p === "number"
              ? { min: p, max: p }
              : { min: p[0], max: p[1] },
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
