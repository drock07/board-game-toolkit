import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** `examples/src`, found upward from the working directory (the docs package when building). */
export function examplesRoot(): string {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const candidate = join(dir, "examples", "src");
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) throw new Error("Can't find examples/src");
  }
}

const MARKER = /^\s*(\/\/|\{\/\*)\s*#(end)?region\b.*$/;

/** Removes the indentation every non-blank line shares. */
function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((l) => l.trim())
    .map((l) => l.match(/^ */)![0].length);
  const cut = Math.min(...indents, Infinity);
  return lines.map((l) => l.slice(cut === Infinity ? 0 : cut));
}

/**
 * A source file from `examples/src`, or one `// #region <name>` of it, with
 * region markers removed. Docs code samples come from tested files this way,
 * so they can't drift from the code that runs.
 */
export function readSource(file: string, region?: string): string {
  const text = readFileSync(join(examplesRoot(), file), "utf8");
  let lines = text.split("\n");
  if (region) {
    const start = lines.findIndex((l) =>
      new RegExp(`#region ${region}\\b`).test(l),
    );
    if (start < 0) throw new Error(`No region "${region}" in ${file}`);
    const end = lines.findIndex(
      (l, i) => i > start && new RegExp(`#endregion ${region}\\b`).test(l),
    );
    if (end < 0) throw new Error(`Region "${region}" in ${file} doesn't end`);
    lines = dedent(lines.slice(start + 1, end));
  }
  return lines
    .filter((l) => !MARKER.test(l))
    .join("\n")
    .trimEnd();
}
