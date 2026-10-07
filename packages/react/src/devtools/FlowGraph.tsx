import type { Spec, State } from "@drock07/board-game-toolkit-engine";
import type { Kind, SpecNode } from "@drock07/board-game-toolkit-engine/kinds";
import type { CSSProperties, ReactNode } from "react";
import { badge, mono, t } from "./theme.js";

/** What the graph needs from a game: its spec, and its kinds to find children. */
export interface GraphGame {
  readonly spec: Spec;
  readonly kinds: Record<string, Kind>;
}

export interface FlowActivity {
  /** Frames per node, across the root stack and every fiber. */
  active: Map<string, number>;
  /** Nodes waiting for input. */
  waiting: Set<string>;
}

/** Which nodes are running, and which wait for input, in a state. */
export function flowActivity(
  game: GraphGame,
  state?: Pick<State<unknown>, "flow" | "fibers">,
): FlowActivity {
  const active = new Map<string, number>();
  const waiting = new Set<string>();
  if (!state) return { active, waiting };
  const stacks = [
    state.flow,
    ...Object.values(state.fibers).map((f) => f.stack),
  ];
  for (const stack of stacks) {
    for (const frame of stack)
      active.set(frame.id, (active.get(frame.id) ?? 0) + 1);
    const top = stack.at(-1);
    // A frame blocked on its child fibers isn't waiting for input
    if (top && !top.children?.length) {
      const node = findNode(game, top.id);
      if (node && game.kinds[node.kind]?.actions) waiting.add(top.id);
    }
  }
  return { active, waiting };
}

const roots = (game: GraphGame): SpecNode[] => [
  game.spec.flow,
  ...(game.spec.abilities ?? []),
  ...(game.spec.effects ?? []),
];

function findNode(game: GraphGame, id: string): SpecNode | undefined {
  const visit = (n: SpecNode): SpecNode | undefined => {
    if (n.id === id) return n;
    for (const c of game.kinds[n.kind]?.children(n) ?? []) {
      const hit = visit(c);
      if (hit) return hit;
    }
    return undefined;
  };
  for (const r of roots(game)) {
    const hit = visit(r);
    if (hit) return hit;
  }
  return undefined;
}

const isNode = (v: unknown): v is SpecNode =>
  typeof v === "object" && v !== null && "kind" in v && "id" in v;

/**
 * One-line facts about a node, from its spec: labels, the names of the
 * conditions and queries it consults (`turns.until`), its actions, and any
 * other plain settings. Child nodes are drawn, not listed.
 */
export function nodeDetails(node: SpecNode): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "kind" || key === "id" || isNode(value)) continue;
    if (typeof value === "string" || typeof value === "number")
      out.push(key === "label" ? `“${value}”` : `${key} ${value}`);
    else if (Array.isArray(value) && value.every((v) => typeof v === "string"))
      out.push(`${key} ${value.join(", ")}`);
    else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every((v) => typeof v === "number")
    )
      out.push(
        `${key} ${Object.entries(value)
          .map(([k, v]) => `${k} ${String(v)}`)
          .join(", ")}`,
      );
  }
  return out;
}

const arrow = (
  <span
    aria-hidden
    style={{ color: t.faint, alignSelf: "center", ...mono(14) }}
  >
    →
  </span>
);

const label = (text: string): ReactNode => (
  <div style={{ ...mono(11), color: t.muted, whiteSpace: "nowrap" }}>
    {text}
  </div>
);

interface BoxProps {
  game: GraphGame;
  node: SpecNode;
  activity: FlowActivity;
}

function Box({ game, node, activity }: BoxProps) {
  const frames = activity.active.get(node.id) ?? 0;
  const waiting = activity.waiting.has(node.id);
  const status = waiting ? "waiting" : frames ? "active" : "idle";
  const details = nodeDetails(node);
  const box: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "6px 8px",
    borderRadius: 8,
    border: `${status === "idle" ? 1 : 2}px solid ${status === "idle" ? t.line : t.accent}`,
    background: waiting ? t.accentSoft : t.bg,
    minWidth: 0,
    flexShrink: 0,
  };
  return (
    <div
      data-node={node.id}
      data-status={status}
      title={[`${node.kind} ${node.id}`, ...details].join("\n")}
      style={box}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={badge(
            status === "idle" ? t.muted : t.accent,
            status === "idle" ? t.surface : t.bg,
          )}
        >
          {node.kind}
        </span>
        <span
          style={{
            ...mono(12),
            fontWeight: 600,
            color: status === "idle" ? t.fg : t.accent,
            whiteSpace: "nowrap",
          }}
        >
          {node.id}
        </span>
        {frames > 1 && (
          <span style={{ ...mono(11), color: t.accent }}>×{frames}</span>
        )}
      </div>
      {details.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {details.map((d) => (
            <div key={d}>{label(d)}</div>
          ))}
        </div>
      )}
      <Children game={game} node={node} activity={activity} />
    </div>
  );
}

/** A labelled child slot: a branch case, an outcome's handler. */
function Branch({
  text,
  dashed,
  children,
}: {
  text: string;
  dashed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingLeft: 8,
        borderLeft: `2px ${dashed ? "dashed" : "solid"} ${t.line}`,
      }}
    >
      {label(text)}
      {children}
    </div>
  );
}

const row: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "flex-start",
};
const column: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

/** Kinds that repeat their body, marked ↻. */
const REPEATS = new Set(["loop", "turns"]);

function Children({ game, node, activity }: BoxProps) {
  const box = (n: SpecNode) => (
    <Box key={n.id} game={game} node={n} activity={activity} />
  );
  // Built-ins whose children have roles get labelled slots; any other kind
  // (custom ones included) lists what its `children()` returns
  switch (node.kind) {
    case "seq": {
      const { children } = node as Extract<SpecNode, { kind: "seq" }>;
      return (
        <div style={row}>
          {children.flatMap((c, i) => [
            ...(i
              ? [
                  <span
                    key={`a${i}`}
                    style={{ display: "flex", alignSelf: "stretch" }}
                  >
                    {arrow}
                  </span>,
                ]
              : []),
            box(c),
          ])}
        </div>
      );
    }
    case "branch": {
      const n = node as Extract<SpecNode, { kind: "branch" }>;
      return (
        <div style={column}>
          {n.cases.map((c, i) => (
            <Branch key={i} text={`when ${c.when}`}>
              {box(c.then)}
            </Branch>
          ))}
          {n.else && <Branch text="else">{box(n.else)}</Branch>}
        </div>
      );
    }
    case "outcomes": {
      const n = node as Extract<SpecNode, { kind: "outcomes" }>;
      return (
        <div style={column}>
          {box(n.body)}
          {Object.entries(n.outcomes).map(([name, o]) => (
            <Branch
              key={name}
              text={`on ${name}${o.when ? ` (when ${o.when})` : ""}`}
              dashed
            >
              {o.then ? box(o.then) : label("ends")}
            </Branch>
          ))}
        </div>
      );
    }
  }
  const children = game.kinds[node.kind]?.children(node) ?? [];
  if (!children.length) return null;
  if (REPEATS.has(node.kind))
    return (
      <div style={{ ...row, alignItems: "center" }}>
        {children.map(box)}
        <span aria-hidden style={{ ...mono(14), color: t.faint }}>
          ↻
        </span>
      </div>
    );
  return <div style={column}>{children.map(box)}</div>;
}

/**
 * The flow as nested boxes: sequences run left to right, branches and
 * outcomes stack, and repeating nodes are marked ↻. Abilities and effects
 * follow the flow. Given a state, running nodes are outlined and nodes
 * waiting for input are filled. Custom kinds are drawn from their
 * `children()`.
 */
export function FlowGraph({
  game,
  state,
  style,
}: {
  game: GraphGame;
  /** The state to highlight. */
  state?: Pick<State<unknown>, "flow" | "fibers">;
  style?: CSSProperties;
}) {
  const activity = flowActivity(game, state);
  const extras = [...(game.spec.abilities ?? []), ...(game.spec.effects ?? [])];
  return (
    <div
      role="figure"
      aria-label="Game flow"
      style={{
        ...column,
        gap: 14,
        fontFamily: t.sans,
        color: t.fg,
        overflow: "auto",
        ...style,
      }}
    >
      <Box game={game} node={game.spec.flow} activity={activity} />
      {extras.map((n) => (
        <Box key={n.id} game={game} node={n} activity={activity} />
      ))}
    </div>
  );
}
