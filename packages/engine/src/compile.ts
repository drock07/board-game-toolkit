import { GameDefinitionError } from "./errors.js";
import { IMPL_CATEGORIES, type GameImpl, type ImplCategory } from "./impl.js";
import type { FlowNode, GameSpec } from "./spec.js";
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
  nodes: ReadonlyMap<NodeId, CompiledNode>;
  root: NodeId;
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

function collectRefs(node: FlowNode, refs: Refs) {
  const at = `node "${node.id}"`;
  if (node.locals) addRef(refs, "locals", node.locals, at);
  for (const c of Object.values(node.exits ?? {}))
    addRef(refs, "conditions", c, at);
  switch (node.kind) {
    case "loop":
      if (node.until) addRef(refs, "conditions", node.until, at);
      if (node.while) addRef(refs, "conditions", node.while, at);
      break;
    case "each":
      if (node.until) addRef(refs, "conditions", node.until, at);
      if ("ref" in node.over) addRef(refs, "lists", node.over.ref, at);
      else if (typeof node.over.from === "object") {
        addRef(refs, "lists", node.over.from.ref, at);
      }
      break;
    case "branch":
      for (const c of node.cases) addRef(refs, "conditions", c.when, at);
      break;
    case "step":
      addRef(refs, "steps", node.run, at);
      break;
    case "decision":
      if (node.endWhen) addRef(refs, "conditions", node.endWhen, at);
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
  for (const child of childNodes(node)) collectRefs(child, refs);
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

  const visit = (node: FlowNode, parent?: NodeId) => {
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
    for (const child of childNodes(node)) visit(child, node.id);
  };
  visit(spec.flow);

  if (spec.players.min < 1 || spec.players.min > spec.players.max) {
    problems.push(
      `Invalid player range ${spec.players.min}..${spec.players.max}`,
    );
  }

  // Refs: every ref must exist in the impl, and every impl entry must be used
  const refs = Object.fromEntries(
    IMPL_CATEGORIES.map((c) => [c, new Map<string, string[]>()]),
  ) as Refs;
  collectRefs(spec.flow, refs);
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
  return { spec, impl, nodes, root: spec.flow.id };
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
