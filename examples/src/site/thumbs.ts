// Line-art thumbnails, ported from the mockups' bgt.js. Colors are CSS
// variables, so they follow the theme.

const I = "var(--ink-2)";
const A = "var(--accent)";
const P = "var(--panel)";
const SW = 1.6;

interface RectOpts {
  rx?: number;
  fill?: string;
  stroke?: string;
  sw?: number;
  t?: string;
}

const r = (x: number, y: number, w: number, h: number, o: RectOpts = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 3}" style="fill:${o.fill ?? P};stroke:${o.stroke ?? I};stroke-width:${o.sw ?? SW}" ${o.t ? `transform="${o.t}"` : ""}/>`;
const l = (a: number, b: number, x: number, y: number, col = I, w = SW) =>
  `<line x1="${a}" y1="${b}" x2="${x}" y2="${y}" style="stroke:${col};stroke-width:${w}" stroke-linecap="round"/>`;
const t = (x: number, y: number, txt: string, col = I, fs = 12) =>
  `<text x="${x}" y="${y}" font-size="${fs}" font-weight="700" style="fill:${col}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif">${txt}</text>`;
const circle = (cx: number, cy: number, rad: number, col = I, fill = "none") =>
  `<circle cx="${cx}" cy="${cy}" r="${rad}" style="fill:${fill};stroke:${col};stroke-width:${SW}"/>`;

function hatch(x: number, y: number, w: number, h: number) {
  let s = "";
  for (let i = 6; i < w + h; i += 6) {
    const x1 = x + Math.max(0, i - h);
    const y1 = y + Math.min(i, h);
    const x2 = x + Math.min(i, w);
    const y2 = y + Math.max(0, i - w);
    s += l(x1, y1, x2, y2, I, 0.8);
  }
  return s;
}

function die(x: number, y: number, n: 1 | 3 | 5 | 6, held = false) {
  const pips = {
    1: [[1, 1]],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    5: [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ],
    6: [
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  }[n];
  return (
    r(x, y, 22, 22, { rx: 4, stroke: held ? A : I, sw: held ? 3 : SW }) +
    pips
      .map(
        ([a, b]) =>
          `<circle cx="${x + 5.5 + a! * 5.5}" cy="${y + 5.5 + b! * 5.5}" r="1.8" style="fill:${I}"/>`,
      )
      .join("")
  );
}

const THUMBS: Record<string, () => string> = {
  sandbox: () =>
    r(14, 26, 24, 34) +
    r(18, 22, 24, 34) +
    r(22, 18, 24, 34) +
    hatch(22, 18, 24, 34) +
    r(52, 22, 20, 28, { t: "rotate(-10 62 50)" }) +
    r(62, 20, 20, 28) +
    r(72, 22, 20, 28, { t: "rotate(10 82 50)" }) +
    r(96, 18, 16, 34, { fill: "none", sw: 1 }) +
    r(96, 18, 16, 22) +
    t(104, 34, "♥", A, 11),
  "tic-tac-toe": () =>
    l(48, 10, 48, 70) +
    l(72, 10, 72, 70) +
    l(28, 30, 92, 30) +
    l(28, 50, 92, 50) +
    l(32, 14, 44, 26, A, 3) +
    l(44, 14, 32, 26, A, 3) +
    circle(60, 40, 6) +
    l(76, 34, 88, 46, A, 3) +
    l(88, 34, 76, 46, A, 3) +
    circle(38, 60, 6) +
    l(56, 54, 64, 66, A, 3) +
    l(64, 54, 56, 66, A, 3),
  blackjack: () =>
    r(30, 16, 30, 42, { t: "rotate(-8 45 58)" }) +
    `<g transform="rotate(-8 45 58)">${hatch(30, 16, 30, 42)}</g>` +
    r(56, 20, 30, 42, { t: "rotate(6 71 62)" }) +
    `<g transform="rotate(6 71 62)">${t(64, 33, "A", A, 10)}${t(71, 47, "♠", I, 16)}</g>`,
  "roll-five": () =>
    die(14, 30, 5) +
    die(42, 22, 6, true) +
    die(70, 30, 6, true) +
    die(28, 52, 3) +
    die(84, 52, 1),
  "dungeon-crawl": () => {
    let b = "";
    for (let i = 0; i < 15; i++) {
      const open = i === 7 || i === 8;
      b += `<rect x="${20 + (i % 5) * 16}" y="${12 + Math.floor(i / 5) * 18}" width="16" height="18" style="fill:${open ? "none" : P};stroke:${I};stroke-width:1"/>`;
    }
    return (
      b +
      `<rect x="20" y="12" width="80" height="54" style="fill:none;stroke:${I};stroke-width:${SW}"/>` +
      circle(28, 21, 5, A, A) +
      circle(76, 57, 5) +
      l(73, 54, 79, 60, I, 1.5) +
      r(57, 35, 8, 8, { rx: 1, fill: "none", stroke: A })
    );
  },
  "crazy-eights": () =>
    r(30, 18, 26, 38, { t: "rotate(-14 43 70)" }) +
    r(47, 14, 26, 38) +
    r(64, 18, 26, 38, { t: "rotate(14 77 70)" }) +
    `<g transform="rotate(-14 43 70)">${t(43, 42, "3", I, 13)}</g>` +
    t(60, 39, "8", A, 16) +
    `<g transform="rotate(14 77 70)">${t(77, 42, "5", I, 13)}</g>`,
  "tower-battler": () =>
    `<rect x="28" y="12" width="64" height="6" rx="3" style="fill:none;stroke:${I};stroke-width:1.5"/><rect x="28" y="12" width="42" height="6" rx="3" style="fill:${A}"/>` +
    r(30, 28, 18, 26, { t: "rotate(-8 39 54)" }) +
    r(51, 26, 18, 26) +
    r(72, 28, 18, 26, { t: "rotate(8 81 54)" }) +
    circle(60, 34, 3.5, A) +
    l(55, 44, 65, 44, I, 1.2) +
    l(57, 48, 63, 48, I, 1.2),
  "sealed-bids": () =>
    // Three sealed envelopes and the lot on offer
    [24, 50, 76]
      .map(
        (x, i) =>
          r(x, 40, 22, 16, { stroke: i === 1 ? A : I }) +
          l(x, 40, x + 11, 49, i === 1 ? A : I, 1.2) +
          l(x + 22, 40, x + 11, 49, i === 1 ? A : I, 1.2),
      )
      .join("") +
    `<path d="M46 26 L50 14 L56 22 L60 12 L64 22 L70 14 L74 26 Z" style="fill:${P};stroke:${A};stroke-width:${SW};stroke-linejoin:round"/>`,
  "plus-two": () =>
    r(30, 22, 26, 38, { t: "rotate(-10 43 60)" }) +
    `<g transform="rotate(-10 43 60)">${t(43, 45, "+2", I, 11)}</g>` +
    r(47, 18, 26, 38, { t: "rotate(2 60 56)" }) +
    `<g transform="rotate(2 60 56)">${t(60, 41, "+2", I, 11)}</g>` +
    r(64, 14, 26, 38, { stroke: A, t: "rotate(12 77 52)" }) +
    `<g transform="rotate(12 77 52)">${t(77, 37, "+2", A, 12)}</g>`,
};

/** The thumbnail's SVG markup: constant strings from this file only. */
export const thumbMarkup = (slug: string) => THUMBS[slug]?.() ?? "";
