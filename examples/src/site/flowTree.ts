import type {
  FlowNode,
  Game,
  GameEvent,
  GameState,
  Json,
  NodeId,
} from "@drock07/board-game-toolkit-engine";

export interface FlowRow {
  id: NodeId;
  depth: number;
  /** What kind of node, plus its actions or options. */
  meta: string;
  /** Shown before the id: the outcome an `on` flow handles, or "trigger". */
  via?: string;
  parent?: NodeId;
}

function metaOf(node: FlowNode): string {
  switch (node.kind) {
    case "decision":
      return Object.keys(node.actions).join(" · ");
    case "each":
      return node.mode === "parallel" ? "each · parallel" : "each";
    case "parallel":
      return `parallel · ${node.join}`;
    case "use":
      return "subflow";
    case "exit":
      return `exit → ${node.outcome}`;
    default:
      return node.kind;
  }
}

function childrenOf(node: FlowNode): { node: FlowNode; via?: string }[] {
  const out: { node: FlowNode; via?: string }[] = [];
  switch (node.kind) {
    case "seq":
    case "parallel":
      out.push(...node.children.map((n) => ({ node: n })));
      break;
    case "loop":
    case "each":
      out.push({ node: node.body });
      break;
    case "branch":
      out.push(...node.cases.map((c) => ({ node: c.then, via: c.when })));
      if (node.else) out.push({ node: node.else, via: "else" });
      break;
    case "decision":
      for (const [name, action] of Object.entries(node.actions))
        if (action.then) out.push({ node: action.then, via: name });
      break;
    case "use":
      if ("body" in node) out.push({ node: node.body as FlowNode });
      break;
    default:
      break;
  }
  for (const [outcome, flow] of Object.entries(node.on ?? {}))
    out.push({ node: flow, via: `on ${outcome}` });
  return out;
}

/** Every node of the game's flow and triggers, depth first. */
export function flowRows(game: Game): FlowRow[] {
  const rows: FlowRow[] = [];
  const walk = (
    node: FlowNode,
    depth: number,
    via?: string,
    parent?: NodeId,
  ) => {
    rows.push({
      id: node.id,
      depth,
      meta: metaOf(node),
      ...(via && { via }),
      ...(parent && { parent }),
    });
    for (const c of childrenOf(node)) walk(c.node, depth + 1, c.via, node.id);
  };
  walk(game.flow, 0);
  for (const t of game.triggers) walk(t.def.flow, 0, `trigger ${t.def.id}`);
  return rows;
}

export interface FlowActivity {
  /** Nodes with a frame on some fiber. */
  active: Set<NodeId>;
  /** Nodes waiting for input. */
  waiting: Set<NodeId>;
}

export function flowActivity(state: GameState): FlowActivity {
  const active = new Set<NodeId>();
  const waiting = new Set<NodeId>();
  for (const fiber of Object.values(state.flow.fibers)) {
    for (const frame of fiber.stack) active.add(frame.node);
    const top = fiber.stack.at(-1);
    if (fiber.status === "blocked" && top) waiting.add(top.node);
  }
  return { active, waiting };
}

const short = (v: unknown) => {
  const s = JSON.stringify(v);
  return s === undefined
    ? "undefined"
    : s.length > 40
      ? s.slice(0, 39) + "…"
      : s;
};

const ids = (list: string[]) =>
  list.length > 3
    ? `${list.slice(0, 2).join(", ")} +${list.length - 2}`
    : list.join(", ");

/** A one-line description of an event, for the inspector's feed. */
export function describeEvent(e: GameEvent): string {
  switch (e.type) {
    case "created":
      return `created ${e.id} in ${e.entity.zone}`;
    case "moved":
      return `moved ${ids(e.ids)}: ${[...new Set(e.from)].join(", ")} → ${e.to}`;
    case "shuffled":
      return `shuffled ${e.zone}`;
    case "flipped":
      return `flipped ${e.id} face ${e.faceUp ? "up" : "down"}`;
    case "destroyed":
      return `destroyed ${e.id}`;
    case "vars":
    case "locals": {
      const [p, ...rest] = e.patches;
      const where = e.type === "vars" ? "vars" : e.node;
      if (!p) return `${where} unchanged`;
      const path = [where, ...p.path].join(".");
      const what =
        p.op === "remove"
          ? `delete ${path}`
          : `${path} = ${short(p.value as Json)}`;
      return rest.length ? `${what} (+${rest.length})` : what;
    }
    case "custom":
      return `${e.name} ${short(e.payload)}`;
    case "flow":
      return `${e.kind} ${e.node}${e.outcome ? ` → ${e.outcome}` : ""}`;
    case "ended":
      return `ended ${short(e.result)}`;
  }
}
