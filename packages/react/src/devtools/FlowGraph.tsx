import {
  describeCond,
  type Actor,
  type CompiledGame,
  type DeepReadonly,
  type FlowNode,
  type FlowState,
  type NodeId,
  type TriggerDef,
} from "@drock07/board-game-toolkit-engine";
import type { CSSProperties, ReactNode } from "react";
import { badge, mono, t } from "./theme.js";

export interface FlowActivity {
  /** Frames per node, across every fiber. */
  active: Map<NodeId, number>;
  /** Nodes waiting on a prompt. */
  waiting: Set<NodeId>;
}

/** Which nodes are running, and which wait for input, in a flow state. */
export function flowActivity(flow?: DeepReadonly<FlowState>): FlowActivity {
  const active = new Map<NodeId, number>();
  const waiting = new Set<NodeId>();
  for (const fiber of Object.values(flow?.fibers ?? {})) {
    if (fiber.status === "done") continue;
    for (const frame of fiber.stack)
      active.set(frame.node, (active.get(frame.node) ?? 0) + 1);
    const top = fiber.stack.at(-1);
    // A fiber also blocks on its spawned fibers; only a prompt waits on input
    if (fiber.status === "blocked" && top?.prompt) waiting.add(top.node);
  }
  return { active, waiting };
}

const actorText = (a: Actor | undefined) =>
  a === undefined ? "any" : typeof a === "string" ? a : `list ${a.ref}`;

/** One-line facts about a node: its guards, conditions, refs and options. */
export function nodeDetails(node: FlowNode): string[] {
  const out: string[] = [];
  const cond = (label: string, c: unknown) =>
    out.push(`${label} ${describeCond(c as string)}`);
  switch (node.kind) {
    case "loop":
      if (node.while !== undefined) cond("while", node.while);
      if (node.until !== undefined) cond("until", node.until);
      if (node.times !== undefined) out.push(`times ${node.times}`);
      break;
    case "each": {
      const over = node.over;
      out.push(
        "ref" in over
          ? `over list ${over.ref}`
          : `over players ${over.players}${over.from ? ` from ${typeof over.from === "string" ? over.from : `list ${over.from.ref}`}` : ""}`,
      );
      if (node.until !== undefined)
        cond(node.repeat ? "repeat until" : "until", node.until);
      break;
    }
    case "step":
      out.push(`run ${node.run}`);
      break;
    case "decision":
      out.push(`actor ${actorText(node.actor)}`);
      if (node.endWhen !== undefined) cond("end when", node.endWhen);
      break;
    case "choose":
      out.push(
        `actor ${actorText(node.actor)} · ${typeof node.options === "string" ? `options ${node.options}` : `${node.options.length} options`} · apply ${node.apply}`,
      );
      if (node.min !== undefined || node.max !== undefined)
        out.push(`choose ${node.min ?? 1}–${node.max ?? 1}`);
      break;
    case "pause":
      out.push(
        `actor ${actorText(node.actor)}${node.label ? ` · “${node.label}”` : ""}`,
      );
      break;
    case "exit":
      out.push(`raise ${node.outcome}`);
      break;
    case "use":
      out.push(`subflow ${node.subflow}`);
      break;
    default:
      break;
  }
  if (node.locals) out.push(`locals ${node.locals}`);
  for (const [outcome, c] of Object.entries(node.exits ?? {}))
    cond(`exits ${outcome}:`, c);
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

function Box({ node, activity }: { node: FlowNode; activity: FlowActivity }) {
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
  const children = <Children node={node} activity={activity} />;
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
      {children}
      {Object.entries(node.on ?? {}).map(([outcome, flow]) => (
        <Branch key={outcome} text={`on ${outcome}`} dashed>
          <Box node={flow} activity={activity} />
        </Branch>
      ))}
    </div>
  );
}

/** A labelled child slot: a branch case, an action's `then`, an `on` flow. */
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

function Children({
  node,
  activity,
}: {
  node: FlowNode;
  activity: FlowActivity;
}) {
  const box = (n: FlowNode) => <Box key={n.id} node={n} activity={activity} />;
  switch (node.kind) {
    case "seq":
      return (
        <div style={row}>
          {node.children.flatMap((c, i) => [
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
    case "parallel":
      return (
        <div style={column}>
          {label(`∥ join ${node.join}`)}
          {node.children.map(box)}
        </div>
      );
    case "loop":
    case "each":
      return (
        <div style={{ ...row, alignItems: "center" }}>
          {box(node.body)}
          <span aria-hidden style={{ ...mono(14), color: t.faint }}>
            ↻
          </span>
        </div>
      );
    case "branch":
      return (
        <div style={column}>
          {node.cases.map((c, i) => (
            <Branch key={i} text={`when ${describeCond(c.when as string)}`}>
              {box(c.then)}
            </Branch>
          ))}
          {node.else && <Branch text="else">{box(node.else)}</Branch>}
        </div>
      );
    case "decision":
      return (
        <div style={column}>
          <div style={{ ...row, flexWrap: "wrap" }}>
            {Object.entries(node.actions).map(([name, a]) => (
              <span
                key={name}
                style={{
                  ...mono(11),
                  color: t.fg,
                  border: `1px solid ${t.line}`,
                  borderRadius: 4,
                  padding: "0 5px",
                  background: t.surface,
                }}
                title={
                  a.ends === false ? "doesn't end the decision" : undefined
                }
              >
                {name}
                {a.ends === false ? " ↺" : ""}
              </span>
            ))}
          </div>
          {Object.entries(node.actions).map(([name, a]) =>
            a.then ? (
              <Branch key={name} text={`${name} then`}>
                {box(a.then)}
              </Branch>
            ) : null,
          )}
        </div>
      );
    case "use":
      return "body" in node ? box((node as { body: FlowNode }).body) : null;
    default:
      return null;
  }
}

function triggerText(def: TriggerDef): string {
  const on = def.on;
  let s = `on ${on.type}`;
  if (on.type === "moved") {
    if (on.from) s += ` from ${on.from}`;
    if (on.to) s += ` to ${on.to}`;
  }
  if ("entityType" in on && on.entityType) s += ` (${on.entityType})`;
  if (on.type === "custom") s += ` ${on.name}`;
  if (on.type === "flow") s += ` ${on.kind} ${on.node}`;
  if (def.when !== undefined) s += ` when ${describeCond(def.when)}`;
  if (def.priority) s += ` · priority ${def.priority}`;
  return s;
}

/**
 * The flow as nested boxes: sequences run left to right, branches, lanes and
 * `on` flows stack, and loops are marked ↻. Given a flow state, running
 * nodes are outlined and nodes waiting for input are filled.
 */
export function FlowGraph({
  game,
  flow,
  style,
}: {
  game: CompiledGame;
  /** The flow state to highlight, e.g. `state.flow`. */
  flow?: DeepReadonly<FlowState>;
  style?: CSSProperties;
}) {
  const activity = flowActivity(flow);
  return (
    <div
      role="figure"
      aria-label={`Flow of ${game.spec.id}`}
      style={{
        ...column,
        gap: 14,
        fontFamily: t.sans,
        color: t.fg,
        overflow: "auto",
        ...style,
      }}
    >
      <Box node={game.flow} activity={activity} />
      {game.triggers.map(({ def }) => (
        <div key={def.id} style={column}>
          <div style={{ ...row, alignItems: "center" }}>
            <span style={badge(t.bad, t.surface)}>trigger</span>
            <span style={{ ...mono(12), fontWeight: 600 }}>{def.id}</span>
            {label(triggerText(def))}
          </div>
          <Box node={def.flow} activity={activity} />
        </div>
      ))}
    </div>
  );
}
