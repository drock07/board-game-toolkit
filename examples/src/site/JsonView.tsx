import type { ReactNode } from "react";

const isPrimitive = (v: unknown) => v === null || typeof v !== "object";

function Leaf({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-label">{String(value)}</span>;
  if (typeof value === "string")
    return <span className="text-warn">{JSON.stringify(value)}</span>;
  if (typeof value === "number" || typeof value === "boolean")
    return <span className="text-accent">{String(value)}</span>;
  return <>{JSON.stringify(value)}</>;
}

/** Fits on one line: primitives, or a short list or object of them. */
function inline(value: unknown): boolean {
  if (isPrimitive(value)) return true;
  const items = Array.isArray(value) ? value : Object.values(value as object);
  return items.every(isPrimitive) && JSON.stringify(value).length <= 34;
}

function render(value: unknown, pad: string, depth = 0): ReactNode {
  if (isPrimitive(value)) return <Leaf value={value} />;
  const isArray = Array.isArray(value);
  const entries: [string, unknown][] = isArray
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as object);
  const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
  if (!entries.length) return `${open}${close}`;
  // Deep, long values would swamp the panel: summarize them
  if (depth >= 2 && !inline(value))
    return (
      <span className="text-label">
        {open}… {entries.length}
        {close}
      </span>
    );
  const key = (k: string) => (isArray ? null : <>{k}: </>);
  if (inline(value)) {
    return (
      <>
        {open}
        {isArray ? "" : " "}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {key(k)}
            <Leaf value={v} />
            {i < entries.length - 1 && ", "}
          </span>
        ))}
        {isArray ? "" : " "}
        {close}
      </>
    );
  }
  const inner = pad + "  ";
  return (
    <>
      {open}
      {"\n"}
      {entries.map(([k, v], i) => (
        <span key={k}>
          {inner}
          {key(k)}
          {render(v, inner, depth + 1)}
          {i < entries.length - 1 && ","}
          {"\n"}
        </span>
      ))}
      {pad}
      {close}
    </>
  );
}

/** Pretty-printed JSON, colored like the mockups' state panel. */
export function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-page px-3.5 py-3 font-mono text-xs/[1.7] text-ink-2">
      {render(value, "")}
    </pre>
  );
}
