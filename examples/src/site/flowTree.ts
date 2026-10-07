import type { ViewEvent } from "@drock07/board-game-toolkit-engine";
import type { SpecNode } from "@drock07/board-game-toolkit-engine/kinds";
import type { GraphGame } from "@drock07/board-game-toolkit-react/devtools";

export interface FlowRow {
  id: string;
  depth: number;
  /** What kind of node, plus its label or actions. */
  meta: string;
  /** Shown before the id: a branch case, an outcome, or "ability"/"effect". */
  via?: string;
  parent?: string;
}

function metaOf(node: SpecNode): string {
  const n = node as { label?: unknown; actions?: unknown };
  if (typeof n.label === "string") return `${node.kind} · “${n.label}”`;
  if (Array.isArray(n.actions)) return (n.actions as string[]).join(" · ");
  return node.kind;
}

/** A node's children with the role each plays, where the kind gives them one. */
function childrenOf(
  game: GraphGame,
  node: SpecNode,
): { node: SpecNode; via?: string }[] {
  switch (node.kind) {
    case "branch": {
      const n = node as Extract<SpecNode, { kind: "branch" }>;
      return [
        ...n.cases.map((c) => ({ node: c.then, via: c.when })),
        ...(n.else ? [{ node: n.else, via: "else" }] : []),
      ];
    }
    case "outcomes": {
      const n = node as Extract<SpecNode, { kind: "outcomes" }>;
      return [
        { node: n.body },
        ...Object.entries(n.outcomes).flatMap(([name, o]) =>
          o.then ? [{ node: o.then, via: `on ${name}` }] : [],
        ),
      ];
    }
    default:
      return (game.kinds[node.kind]?.children(node) ?? []).map((c) => ({
        node: c,
      }));
  }
}

/** Every node of the game's flow, abilities and effects, depth first. */
export function flowRows(game: GraphGame): FlowRow[] {
  const rows: FlowRow[] = [];
  const walk = (
    node: SpecNode,
    depth: number,
    via?: string,
    parent?: string,
  ) => {
    rows.push({
      id: node.id,
      depth,
      meta: metaOf(node),
      ...(via && { via }),
      ...(parent && { parent }),
    });
    for (const c of childrenOf(game, node))
      walk(c.node, depth + 1, c.via, node.id);
  };
  walk(game.spec.flow, 0);
  for (const a of game.spec.abilities ?? []) walk(a, 0, "ability");
  for (const e of game.spec.effects ?? []) walk(e, 0, "effect");
  return rows;
}

const short = (v: unknown) => {
  const s = JSON.stringify(v);
  return s === undefined
    ? "undefined"
    : s.length > 40
      ? s.slice(0, 39) + "…"
      : s;
};

/** An entity as an event shows it: its id, or its ref when hidden. */
const name = (e: { ref: string; id?: string }) => e.id ?? `?${e.ref}`;

const names = (list: { ref: string; id?: string }[]) =>
  list.length > 3
    ? `${list.slice(0, 2).map(name).join(", ")} +${list.length - 2}`
    : list.map(name).join(", ");

/** A one-line description of an event, for the inspector's feed. */
export function describeEvent(e: ViewEvent): string {
  switch (e.type) {
    case "created":
      return `created ${name(e.entity)} in ${e.entity.zone}`;
    case "moved":
      return `moved ${names(e.entities)}: ${[...new Set(e.from)].join(", ")} → ${e.to}`;
    case "shuffled":
      return `shuffled ${e.zone}`;
    case "flipped":
      return `flipped ${name(e.entity)}`;
    case "updated":
      return `updated ${name(e.entity)}`;
    case "destroyed":
      return `destroyed ${name(e.entity)}`;
    case "vars":
      return `vars = ${short(e.vars)}`;
    case "effect":
      return `${e.name} ${short(e.data)}`;
    case "ended":
      return `ended ${short(e.result)}`;
  }
}
