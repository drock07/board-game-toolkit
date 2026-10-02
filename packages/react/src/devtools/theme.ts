import type { CSSProperties } from "react";

/**
 * Devtools colors and fonts, as CSS variables with light defaults. Set the
 * `--bgt-dt-*` variables on an ancestor to theme them (e.g. for dark mode).
 */
export const t = {
  bg: "var(--bgt-dt-bg, #ffffff)",
  surface: "var(--bgt-dt-surface, #f7f7f5)",
  fg: "var(--bgt-dt-fg, #18181b)",
  muted: "var(--bgt-dt-muted, #6b6b70)",
  faint: "var(--bgt-dt-faint, #a1a1a6)",
  line: "var(--bgt-dt-line, #e4e4e0)",
  accent: "var(--bgt-dt-accent, #3b5bdb)",
  accentSoft: "var(--bgt-dt-accent-soft, #eef1fd)",
  good: "var(--bgt-dt-good, #2f7d4f)",
  bad: "var(--bgt-dt-bad, #c53030)",
  mono: "var(--bgt-dt-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  sans: "var(--bgt-dt-sans, ui-sans-serif, system-ui, sans-serif)",
} as const;

export const mono = (size = 12): CSSProperties => ({
  fontFamily: t.mono,
  fontSize: size,
  lineHeight: 1.5,
});

/** A small rounded label, like a node kind or fiber status. */
export const badge = (color: string, bg: string): CSSProperties => ({
  ...mono(10.5),
  fontWeight: 600,
  color,
  background: bg,
  borderRadius: 4,
  padding: "0 5px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
});
