import { GameDefinitionError } from "./errors.js";
import { checkExpr, condRefs } from "./expr.js";
import { IMPL_CATEGORIES, type GameImpl, type ImplCategory } from "./impl.js";
import type { Cond, FlowNode, GameSpec, TriggerDef, UseNode } from "./spec.js";
import type { NodeId, PlayerId, Zone } from "./types.js";

export interface CompiledNode {
  id: NodeId;
  node: FlowNode;
  parent?: NodeId;
  /** Outcomes this node handles: the keys of its `exits` and `on`. */
  handles: ReadonlySet<string>;
}

/** Every flow node kind the interpreter knows. Checked at compile time. */
export type KindRegistry = ReadonlySet<string>;

export interface CompiledGame {
  spec: GameSpec;
  impl: GameImpl;
  /** The flow with every `use` expanded. */
  flow: FlowNode;
  /** Triggers in firing order: priority (highest first), then declaration order. */
  triggers: { def: TriggerDef }[];
  nodes: ReadonlyMap<NodeId, CompiledNode>;
  root: NodeId;
}

/** A `use` node after compiling: its subflow, with ids prefixed, as `body`. */
export type ExpandedUse = UseNode & { readonly body: FlowNode };

/** Rebuilds a node with `f` applied to each child, slot by slot. */
function mapChildren(
  node: FlowNode,
  f: (child: FlowNode) => FlowNode,
): FlowNode {
  const out: Record<string, unknown> = { ...node };
  switch (node.kind) {
    case "seq":
    case "parallel":
      out.children = node.children.map(f);
      break;
    case "loop":
    case "each":
      out.body = f(node.body);
      break;
    case "branch":
      out.cases = node.cases.map((c) => ({ ...c, then: f(c.then) }));
      if (node.else) out.else = f(node.else);
      break;
    case "decision":
      out.actions = Object.fromEntries(
        Object.entries(node.actions).map(([k, a]) => [
          k,
          a.then ? { ...a, then: f(a.then) } : a,
        ]),
      );
      break;
    case "use":
      if ("body" in node) out.body = f((node as ExpandedUse).body);
      break;
    default:
      break;
  }
  if (node.on) {
    out.on = Object.fromEntries(
      Object.entries(node.on).map(([k, v]) => [k, f(v)]),
    );
  }
  return out as unknown as FlowNode;
}

/** The child nodes of a node, in slot order. */
export function childNodes(node: FlowNode): FlowNode[] {
  const out: FlowNode[] = [];
  switch (node.kind) {
    case "seq":
    case "parallel":
      out.push(...node.children);
      break;
    case "loop":
    case "each":
      out.push(node.body);
      break;
    case "branch":
      out.push(...node.cases.map((c) => c.then));
      if (node.else) out.push(node.else);
      break;
    case "decision":
      for (const a of Object.values(node.actions)) if (a.then) out.push(a.then);
      break;
    case "use":
      if ("body" in node) out.push((node as ExpandedUse).body);
      break;
    default:
      break;
  }
  if (node.on) out.push(...Object.values(node.on));
  return out;
}

/** Whether a flow can ever wait on a prompt. */
function canBlock(node: FlowNode): boolean {
  if (
    node.kind === "decision" ||
    node.kind === "choose" ||
    node.kind === "pause"
  ) {
    return true;
  }
  return childNodes(node).some(canBlock);
}

type Refs = Record<ImplCategory, Map<string, string[]>>;

function addRef(refs: Refs, cat: ImplCategory, name: string, where: string) {
  const list = refs[cat].get(name) ?? [];
  list.push(where);
  refs[cat].set(name, list);
}

/** Conditions found while collecting refs, to check once the spec is known. */
type Conds = [Cond, string][];

function addCond(refs: Refs, conds: Conds, c: Cond, where: string) {
  conds.push([c, where]);
  for (const name of condRefs(c)) addRef(refs, "conditions", name, where);
}

function collectRefs(node: FlowNode, refs: Refs, conds: Conds) {
  const at = `node "${node.id}"`;
  const cond = (c: Cond, what: string) =>
    addCond(refs, conds, c, `${at} ${what}`);
  if (node.locals) addRef(refs, "locals", node.locals, at);
  for (const [outcome, c] of Object.entries(node.exits ?? {}))
    cond(c, `exits.${outcome}`);
  switch (node.kind) {
    case "loop":
      if (node.until) cond(node.until, "until");
      if (node.while) cond(node.while, "while");
      break;
    case "each":
      if (node.until) cond(node.until, "until");
      if ("ref" in node.over) addRef(refs, "lists", node.over.ref, at);
      else if (typeof node.over.from === "object") {
        addRef(refs, "lists", node.over.from.ref, at);
      }
      break;
    case "branch":
      node.cases.forEach((c, i) => cond(c.when, `cases[${i}].when`));
      break;
    case "step":
      addRef(refs, "steps", node.run, at);
      break;
    case "decision":
      if (node.endWhen) cond(node.endWhen, "endWhen");
      for (const name of Object.keys(node.actions))
        addRef(refs, "actions", name, at);
      break;
    case "choose":
      if (typeof node.options === "string")
        addRef(refs, "lists", node.options, at);
      addRef(refs, "choices", node.apply, at);
      break;
    default:
      break;
  }
  if ("actor" in node && typeof node.actor === "object") {
    addRef(refs, "lists", node.actor.ref, at);
  }
  for (const child of childNodes(node)) collectRefs(child, refs, conds);
}

/**
 * Compiles a spec into a node table and validates it against the impl.
 * Throws a `GameDefinitionError` listing every problem found.
 */
export function compile(
  spec: GameSpec,
  impl: GameImpl,
  kinds: KindRegistry,
): CompiledGame {
  const problems: string[] = [];
  const nodes = new Map<NodeId, CompiledNode>();

  // Expand `use` nodes: each gets its subflow as `body`, with every node id
  // inside prefixed by the use node's id, so `use("combat", "combat")` turns
  // the subflow's "fight" into "combat.fight"
  const usedSubflows = new Set<string>();
  const expand = (
    node: FlowNode,
    prefix: string,
    stack: string[],
  ): FlowNode => {
    const renamed = {
      ...mapChildren(node, (c) => expand(c, prefix, stack)),
      id: prefix + node.id,
    } as FlowNode;
    if (renamed.kind !== "use") return renamed;
    const sub = spec.subflows?.[renamed.subflow];
    if (!sub) {
      problems.push(
        `Node "${renamed.id}" uses unknown subflow "${renamed.subflow}"`,
      );
      return renamed;
    }
    if (stack.includes(renamed.subflow)) {
      problems.push(
        `Subflow "${renamed.subflow}" uses itself (${[...stack, renamed.subflow].join(" → ")})`,
      );
      return renamed;
    }
    usedSubflows.add(renamed.subflow);
    const body = expand(sub, `${renamed.id}.`, [...stack, renamed.subflow]);
    return { ...renamed, body } as ExpandedUse;
  };
  const flow = expand(spec.flow, "", []);
  const triggers = (spec.triggers ?? [])
    .map((def, index) => ({
      def: { ...def, flow: expand(def.flow, "", []) },
      index,
    }))
    .sort(
      (a, b) =>
        (b.def.priority ?? 0) - (a.def.priority ?? 0) || a.index - b.index,
    )
    .map(({ def }) => ({ def }));
  for (const name of Object.keys(spec.subflows ?? {})) {
    if (!usedSubflows.has(name)) problems.push(`Unused subflow "${name}"`);
  }

  // `handled` is null inside trigger flows: they run on whatever fiber fired
  // them, so which outcomes are handled below them isn't known statically
  const visit = (
    node: FlowNode,
    parent?: NodeId,
    underPlayers = false,
    handled: ReadonlySet<string> | null = new Set(),
  ) => {
    if (nodes.has(node.id)) problems.push(`Duplicate node id "${node.id}"`);
    if (!kinds.has(node.kind)) {
      problems.push(`Node "${node.id}" has unsupported kind "${node.kind}"`);
    }
    const handles = new Set([
      ...Object.keys(node.exits ?? {}),
      ...Object.keys(node.on ?? {}),
    ]);
    const compiled: CompiledNode = { id: node.id, node, handles };
    if (parent !== undefined) compiled.parent = parent;
    nodes.set(node.id, compiled);

    if (
      node.kind === "loop" &&
      node.until === undefined &&
      node.while === undefined &&
      node.times === undefined &&
      !node.exits &&
      !canBlock(node.body)
    ) {
      problems.push(
        `Loop "${node.id}" can never end or wait for input: give it until, while, times or exits, or a body that prompts`,
      );
    }
    if ("actor" in node && node.actor === "current" && !underPlayers) {
      problems.push(
        `Node "${node.id}" uses actor "current" outside an each over players`,
      );
    }
    if (node.kind === "choose") {
      const { min = 1, max = 1 } = node;
      if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 0 ||
        max < 1 ||
        min > max
      ) {
        problems.push(
          `Choose "${node.id}" needs whole numbers 0 <= min <= max, max >= 1`,
        );
      }
    }
    if (
      node.kind === "each" &&
      node.mode === "parallel" &&
      (node.until || node.repeat)
    ) {
      problems.push(
        `Each "${node.id}": until and repeat only apply in sequential mode`,
      );
    }
    if (node.kind === "exit") {
      if (node.outcome === "done") {
        problems.push(
          `Exit "${node.id}" can't raise "done", the normal outcome`,
        );
      } else if (handled && !handled.has(node.outcome)) {
        problems.push(
          `Exit "${node.id}" raises "${node.outcome}", which no enclosing node handles (list it in exits or on)`,
        );
      }
    }
    // An each over players binds `current` for its body, not its `on` flows,
    // and a node doesn't handle outcomes raised from its own `on` flows
    const binds = node.kind === "each" && "players" in node.over;
    const onFlows = new Set(Object.values(node.on ?? {}));
    const handledBelow = handled && new Set([...handled, ...handles]);
    for (const child of childNodes(node)) {
      const inOn = onFlows.has(child);
      visit(
        child,
        node.id,
        underPlayers || (binds && !inOn),
        inOn ? handled : handledBelow,
      );
    }
  };
  visit(flow);
  const zoneNames = new Set(Object.keys(spec.zones));
  for (const { def } of triggers) {
    // Trigger flows may use "current": it resolves from the interrupted flow
    visit(def.flow, undefined, true, null);
    const { on } = def;
    for (const zone of "from" in on || "to" in on ? [on.from, on.to] : []) {
      if (zone !== undefined && !zoneNames.has(zone)) {
        problems.push(`Trigger "${def.id}" names unknown zone "${zone}"`);
      }
    }
  }
  for (const { def } of triggers) {
    if (def.on.type === "flow" && !nodes.has(def.on.node)) {
      problems.push(
        `Trigger "${def.id}" watches unknown node "${def.on.node}"`,
      );
    }
  }
  const ids = (spec.triggers ?? []).map((t) => t.id);
  if (new Set(ids).size !== ids.length)
    problems.push("Trigger ids must be unique");

  if (spec.players.min < 1 || spec.players.min > spec.players.max) {
    problems.push(
      `Invalid player range ${spec.players.min}..${spec.players.max}`,
    );
  }

  // Refs: every ref must exist in the impl, and every impl entry must be used
  const refs = Object.fromEntries(
    IMPL_CATEGORIES.map((c) => [c, new Map<string, string[]>()]),
  ) as Refs;
  const conds: Conds = [];
  collectRefs(flow, refs, conds);
  for (const { def } of triggers) {
    collectRefs(def.flow, refs, conds);
    if (def.when) addCond(refs, conds, def.when, `trigger "${def.id}" when`);
  }
  for (const [c, where] of conds) problems.push(...checkExpr(c, where, spec));
  for (const [name, def] of Object.entries(spec.zones)) {
    if (typeof def.visibility === "object") {
      addRef(refs, "visibility", def.visibility.ref, `zone "${name}"`);
    }
  }
  for (const cat of IMPL_CATEGORIES) {
    const entries = (impl[cat] ?? {}) as Record<string, unknown>;
    for (const [name, where] of refs[cat]) {
      if (!(name in entries)) {
        problems.push(
          `Missing impl.${cat}.${name} (used by ${where.join(", ")})`,
        );
      }
    }
    for (const name of Object.keys(entries)) {
      if (!refs[cat].has(name)) {
        problems.push(
          `Unused impl.${cat}.${name}: the spec never references it`,
        );
      }
    }
  }

  if (problems.length) {
    throw new GameDefinitionError(
      `Invalid game "${spec.id}":\n  ${problems.join("\n  ")}`,
    );
  }
  return { spec, impl, flow, triggers, nodes, root: flow.id };
}

/** The zones a game has for a given seating. */
export function zonesFor(
  spec: GameSpec,
  players: readonly PlayerId[],
): Omit<Zone, "items">[] {
  const zones: Omit<Zone, "items">[] = [];
  for (const [name, def] of Object.entries(spec.zones)) {
    if (def.perPlayer) {
      for (const p of players)
        zones.push({ id: `${name}:${p}`, def: name, owner: p });
    } else {
      zones.push({ id: name, def: name });
    }
  }
  return zones;
}
