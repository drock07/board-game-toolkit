import type { State } from "@drock07/board-game-toolkit-engine";
import type { Frame } from "@drock07/board-game-toolkit-engine/kinds";
import type { CSSProperties, ReactNode } from "react";
import { flowActivity, type GraphGame } from "./FlowGraph.js";
import { badge, mono, t } from "./theme.js";

type FlowState = Pick<State<unknown>, "flow" | "fibers" | "pending">;
type Pending = State<unknown>["pending"][number];

const short = (v: unknown, max = 60) => {
  const s = JSON.stringify(v);
  return s === undefined ? "" : s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

type Status = "running" | "waiting" | "blocked";

const STATUS: Record<Status, [string, string]> = {
  running: [t.good, t.surface],
  waiting: [t.accent, t.accentSoft],
  blocked: [t.muted, t.surface],
};

const cell: CSSProperties = {
  ...mono(11.5),
  padding: "3px 8px",
  borderTop: `1px solid ${t.line}`,
  verticalAlign: "top",
  textAlign: "left",
};

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", color: t.fg }}>
        <thead>
          <tr style={{ color: t.muted }}>
            {head.map((h) => (
              <th
                key={h}
                style={{ ...cell, borderTop: "none", fontWeight: 500 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Card({
  id,
  status,
  note,
  children,
}: {
  id: string;
  status?: Status;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-fiber={id}
      aria-label={`Fiber ${id}`}
      style={{
        border: `1px solid ${t.line}`,
        borderRadius: 8,
        background: t.bg,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          background: t.surface,
        }}
      >
        <span style={{ ...mono(12), fontWeight: 600 }}>{id}</span>
        {status && <span style={badge(...STATUS[status])}>{status}</span>}
        {note && <span style={{ ...mono(11), color: t.muted }}>{note}</span>}
      </header>
      {children}
    </section>
  );
}

function Stack({
  stack,
  waiting,
}: {
  stack: readonly Frame[];
  waiting: Set<string>;
}) {
  return (
    <Table head={["#", "node", "pass", "data", "children"]}>
      {/* Innermost frame first: it's the one running or waiting */}
      {[...stack].reverse().map((frame, i) => {
        const index = stack.length - 1 - i;
        const top = i === 0;
        return (
          <tr
            key={index}
            style={{
              background:
                top && waiting.has(frame.id) ? t.accentSoft : undefined,
            }}
          >
            <td style={{ ...cell, color: t.muted }}>{index}</td>
            <td
              style={{
                ...cell,
                fontWeight: top ? 600 : 400,
                color: /^(ability|effect)/.test(frame.id) ? t.bad : undefined,
              }}
            >
              {frame.id}
            </td>
            <td style={{ ...cell, color: t.muted }}>{frame.i}</td>
            <td
              style={{ ...cell, color: t.muted }}
              title={JSON.stringify(frame.data)}
            >
              {frame.data === undefined ? "" : short(frame.data)}
            </td>
            <td style={cell}>{frame.children?.join(", ") ?? ""}</td>
          </tr>
        );
      })}
    </Table>
  );
}

const statusOf = (stack: readonly Frame[], waiting: Set<string>): Status => {
  const top = stack.at(-1);
  if (top?.children?.length) return "blocked";
  return top && waiting.has(top.id) ? "waiting" : "running";
};

const pendingText = (p: Pending) =>
  "ability" in p
    ? `ability ${p.ability}${p.self ? ` · self ${p.self}` : ""}${p.owner ? ` · owner ${p.owner}` : ""}`
    : `effect ${p.effect} · ${short(p.data, 40)}`;

/**
 * The flow as the engine runs it: the root stack and every child fiber,
 * each frame with its pass count and data, innermost first, then the
 * abilities and effects queued to run. Frames the engine pushed for an
 * ability or effect are marked.
 */
export function FiberInspector({
  game,
  state,
  style,
}: {
  game: GraphGame;
  state: FlowState;
  style?: CSSProperties;
}) {
  const { waiting } = flowActivity(game, state);
  const fibers = Object.values(state.fibers);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: t.sans,
        color: t.fg,
        ...style,
      }}
    >
      <div style={{ ...mono(11), color: t.muted }}>
        {fibers.length + 1} fiber{fibers.length ? "s" : ""} ·{" "}
        {state.pending.length} pending
      </div>
      <Card id="root" status={statusOf(state.flow, waiting)}>
        <Stack stack={state.flow} waiting={waiting} />
      </Card>
      {fibers.map((f) => (
        <Card
          key={f.id}
          id={f.id}
          status={statusOf(f.stack, waiting)}
          note={`spawned by ${f.parent} frame ${f.at}${f.player ? ` · for ${f.player}` : ""}`}
        >
          <Stack stack={f.stack} waiting={waiting} />
        </Card>
      ))}
      {state.pending.length > 0 && (
        <Card id="pending" note="next first">
          <Table head={["#", "queued", "on fiber", "depth"]}>
            {state.pending.map((p, i) => (
              <tr key={i}>
                <td style={{ ...cell, color: t.muted }}>{i}</td>
                <td style={cell}>{pendingText(p)}</td>
                <td style={cell}>{p.fiber}</td>
                <td style={{ ...cell, color: t.muted }}>{p.depth}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
