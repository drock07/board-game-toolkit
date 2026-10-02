import type {
  DeepReadonly,
  Fiber,
  FlowState,
  Frame,
} from "@drock07/board-game-toolkit-engine";
import type { CSSProperties } from "react";
import { badge, mono, t } from "./theme.js";

const short = (v: unknown, max = 60) => {
  const s = JSON.stringify(v);
  return s === undefined ? "" : s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function bindingText(b: DeepReadonly<Frame>["binding"]): string {
  if (!b) return "";
  const parts: string[] = [];
  if (b.player !== undefined) parts.push(`player ${b.player}`);
  if (b.item !== undefined) parts.push(`item ${short(b.item, 24)}`);
  if (b.iteration !== undefined) parts.push(`iteration ${b.iteration}`);
  return parts.join(" · ");
}

const STATUS: Record<Fiber["status"], [string, string]> = {
  runnable: [t.good, t.surface],
  blocked: [t.accent, t.accentSoft],
  done: [t.muted, t.surface],
};

const cell: CSSProperties = {
  ...mono(11.5),
  padding: "3px 8px",
  borderTop: `1px solid ${t.line}`,
  verticalAlign: "top",
  textAlign: "left",
};

function FiberCard({ fiber }: { fiber: DeepReadonly<Fiber> }) {
  const [color, bg] = STATUS[fiber.status];
  return (
    <section
      data-fiber={fiber.id}
      aria-label={`Fiber ${fiber.id}`}
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
        <span style={{ ...mono(12), fontWeight: 600 }}>{fiber.id}</span>
        <span style={badge(color, bg)}>{fiber.status}</span>
        {fiber.parent && (
          <span style={{ ...mono(11), color: t.muted }}>
            spawned by {fiber.parent.fiber} frame {fiber.parent.frame}
          </span>
        )}
        {fiber.outcome && (
          <span style={{ ...mono(11), color: t.muted }}>→ {fiber.outcome}</span>
        )}
      </header>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ borderCollapse: "collapse", width: "100%", color: t.fg }}
        >
          <thead>
            <tr style={{ color: t.muted }}>
              {["#", "node", "phase", "binding", "locals", "prompt"].map(
                (h) => (
                  <th
                    key={h}
                    style={{ ...cell, borderTop: "none", fontWeight: 500 }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {/* Innermost frame first: it's the one running or waiting */}
            {[...fiber.stack].reverse().map((frame, i) => {
              const index = fiber.stack.length - 1 - i;
              const top = i === 0;
              return (
                <tr
                  key={index}
                  style={{
                    background: frame.prompt ? t.accentSoft : undefined,
                  }}
                >
                  <td style={{ ...cell, color: t.muted }}>{index}</td>
                  <td style={{ ...cell, fontWeight: top ? 600 : 400 }}>
                    {frame.node}
                    {frame.trigger && (
                      <span style={{ color: t.bad }}>
                        {" "}
                        · trigger {frame.trigger}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cell, color: t.muted }}>{frame.phase}</td>
                  <td style={cell}>{bindingText(frame.binding)}</td>
                  <td
                    style={{ ...cell, color: t.muted }}
                    title={JSON.stringify(frame.locals)}
                  >
                    {frame.locals === undefined ? "" : short(frame.locals)}
                  </td>
                  <td style={cell}>
                    {frame.prompt
                      ? `${frame.prompt.id} → ${frame.prompt.actors.join(", ")}`
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Every fiber in a flow state, with its frame stack: node, phase, binding,
 * locals and open prompt. Fibers that have finished are left out unless
 * `showDone` is set.
 */
export function FiberInspector({
  flow,
  showDone = false,
  style,
}: {
  flow: DeepReadonly<FlowState>;
  showDone?: boolean;
  style?: CSSProperties;
}) {
  const fibers = Object.values(flow.fibers)
    .filter((f) => showDone || f.status !== "done")
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
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
        {fibers.length} fiber{fibers.length === 1 ? "" : "s"}
      </div>
      {fibers.map((f) => (
        <FiberCard key={f.id} fiber={f} />
      ))}
    </div>
  );
}
