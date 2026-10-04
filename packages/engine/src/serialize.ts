import { GameDefinitionError } from "./errors.js";
import { checkExpr } from "./expr.js";
import type { GameSpec } from "./spec.js";

/** Identifies spec JSON written by `toJSON`. */
export const SPEC_FORMAT = "board-game-toolkit/spec";
export const SPEC_FORMAT_VERSION = 1;

export interface SpecDocument {
  format: typeof SPEC_FORMAT;
  formatVersion: number;
  spec: GameSpec;
}

/**
 * A spec as JSON text, ready to save, diff or load with `fromJSON`. Specs are
 * already plain data, so this is a wrapper with a format marker.
 */
export function toJSON(spec: GameSpec): string {
  const doc: SpecDocument = {
    format: SPEC_FORMAT,
    formatVersion: SPEC_FORMAT_VERSION,
    spec,
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * Reads spec JSON written by `toJSON` and checks its shape. Pass the result
 * to `defineGame` with an impl, which checks refs and flow rules as usual.
 * Throws `GameDefinitionError` listing every problem, with its path.
 */
export function fromJSON(text: string): GameSpec {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    throw new GameDefinitionError(
      `Spec JSON doesn't parse: ${(err as Error).message}`,
    );
  }
  if (!isObject(doc) || doc.format !== SPEC_FORMAT) {
    throw new GameDefinitionError(
      `Not a spec document: expected "format": "${SPEC_FORMAT}"`,
    );
  }
  if (doc.formatVersion !== SPEC_FORMAT_VERSION) {
    throw new GameDefinitionError(
      `Unsupported spec format version ${JSON.stringify(doc.formatVersion)} (this engine reads ${SPEC_FORMAT_VERSION})`,
    );
  }
  const problems = checkSpecShape(doc.spec);
  if (problems.length) {
    throw new GameDefinitionError(
      `Invalid spec JSON:\n  ${problems.join("\n  ")}`,
    );
  }
  return doc.spec as GameSpec;
}

// ---------------------------------------------------------------------------
// Shape checking. Each check pushes "path: problem" messages.

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type Check = (v: unknown, at: string, out: string[]) => void;

const str: Check = (v, at, out) => {
  if (typeof v !== "string" || !v) out.push(`${at}: expected a string`);
};
const bool: Check = (v, at, out) => {
  if (typeof v !== "boolean") out.push(`${at}: expected true or false`);
};
const int: Check = (v, at, out) => {
  if (!Number.isInteger(v)) out.push(`${at}: expected a whole number`);
};
const oneOf =
  (...values: string[]): Check =>
  (v, at, out) => {
    if (typeof v !== "string" || !values.includes(v))
      out.push(
        `${at}: expected one of ${values.map((x) => `"${x}"`).join(", ")}`,
      );
  };
const ref: Check = (v, at, out) => {
  if (!isObject(v) || typeof v.ref !== "string" || Object.keys(v).length !== 1)
    out.push(`${at}: expected { ref: string }`);
};
const either =
  (a: Check, b: Check, what: string): Check =>
  (v, at, out) => {
    const x: string[] = [];
    a(v, at, x);
    if (!x.length) return;
    const y: string[] = [];
    b(v, at, y);
    if (y.length) out.push(`${at}: expected ${what}`);
  };
const record =
  (each: Check): Check =>
  (v, at, out) => {
    if (!isObject(v)) {
      out.push(`${at}: expected an object`);
      return;
    }
    for (const [k, x] of Object.entries(v)) each(x, `${at}.${k}`, out);
  };

/** Checks an object's fields: required, optional, and no others. */
function fields(
  v: unknown,
  at: string,
  out: string[],
  required: Record<string, Check>,
  optional: Record<string, Check> = {},
) {
  if (!isObject(v)) {
    out.push(`${at}: expected an object`);
    return;
  }
  for (const [k, check] of Object.entries(required)) {
    if (v[k] === undefined) out.push(`${at}: missing "${k}"`);
    else check(v[k], `${at}.${k}`, out);
  }
  for (const [k, x] of Object.entries(v)) {
    if (k in required || x === undefined) continue;
    const check = optional[k];
    if (check) check(x, `${at}.${k}`, out);
    else out.push(`${at}: unknown field "${k}"`);
  }
}

function checkSpecShape(spec: unknown): string[] {
  const out: string[] = [];
  if (!isObject(spec)) return ["spec: expected an object"];
  const zones = isObject(spec.zones) ? spec.zones : {};
  const vars = isObject(spec.vars) ? spec.vars : undefined;

  const cond: Check = (v, at, o) => {
    if (typeof v === "string") return;
    o.push(
      ...checkExpr(v, at, {
        zones: zones as never,
        ...(vars && { vars: vars as never }),
      }),
    );
  };
  const actor: Check = either(
    oneOf("current", "any"),
    either(str, ref, "a player id or { ref }"),
    `"current", "any", a player id or { ref }`,
  );
  const node: Check = (v, at, o) => {
    if (!isObject(v)) {
      o.push(`${at}: expected a flow node`);
      return;
    }
    const common = {
      locals: str,
      exits: record(cond),
      on: record(node),
    };
    const req = { kind: str, id: str };
    const kind = v.kind;
    const opt = (extra: Record<string, Check>) => ({ ...common, ...extra });
    switch (kind) {
      case "seq":
        fields(v, at, o, { ...req, children: list(node) }, common);
        break;
      case "parallel":
        fields(
          v,
          at,
          o,
          { ...req, children: list(node), join: oneOf("all", "race") },
          common,
        );
        break;
      case "loop":
        fields(
          v,
          at,
          o,
          { ...req, body: node },
          opt({ until: cond, while: cond, times: int }),
        );
        break;
      case "each":
        fields(
          v,
          at,
          o,
          { ...req, over: over, body: node },
          opt({
            mode: oneOf("sequential", "parallel"),
            until: cond,
            repeat: bool,
          }),
        );
        break;
      case "branch":
        fields(
          v,
          at,
          o,
          {
            ...req,
            cases: list((c, a, x) =>
              fields(c, a, x, { when: cond, then: node }),
            ),
          },
          opt({ else: node }),
        );
        break;
      case "step":
        fields(v, at, o, { ...req, run: str }, common);
        break;
      case "decision":
        fields(
          v,
          at,
          o,
          {
            ...req,
            actor,
            actions: record((a, p, x) =>
              fields(a, p, x, {}, { ends: bool, then: node }),
            ),
          },
          opt({ endWhen: cond }),
        );
        break;
      case "choose":
        fields(
          v,
          at,
          o,
          {
            ...req,
            actor,
            options: either(
              str,
              list(() => {}),
              "a list name or an array",
            ),
            apply: str,
          },
          opt({ min: int, max: int }),
        );
        break;
      case "pause":
        fields(v, at, o, req, opt({ actor, label: str }));
        break;
      case "exit":
        fields(v, at, o, { ...req, outcome: str }, common);
        break;
      case "use":
        fields(v, at, o, { ...req, subflow: str }, common);
        break;
      default:
        // A custom kind (see `defineGame`'s `kinds`): only its id is checked here
        str(v.id, `${at}.id`, o);
        str(kind, `${at}.kind`, o);
    }
  };
  const over: Check = (v, at, o) => {
    if (isObject(v) && "ref" in v) ref(v, at, o);
    else
      fields(
        v,
        at,
        o,
        { players: oneOf("clockwise", "counterclockwise") },
        {
          from: either(
            oneOf("first", "random"),
            ref,
            `"first", "random" or { ref }`,
          ),
        },
      );
  };
  const zone: Check = (v, at, o) =>
    fields(
      v,
      at,
      o,
      {
        visibility: either(
          oneOf("public", "hidden", "owner", "top"),
          ref,
          `"public", "hidden", "owner", "top" or { ref }`,
        ),
      },
      {
        perPlayer: bool,
        count: either(int, ref, "a whole number or { ref }"),
        ordered: bool,
        revealType: bool,
      },
    );
  const pattern: Check = (v, at, o) => {
    const type = isObject(v) ? v.type : undefined;
    if (type === "moved")
      fields(v, at, o, { type: str }, { from: str, to: str, entityType: str });
    else if (type === "created" || type === "destroyed" || type === "flipped")
      fields(v, at, o, { type: str }, { entityType: str });
    else if (type === "custom") fields(v, at, o, { type: str, name: str });
    else if (type === "flow")
      fields(v, at, o, { type: str, kind: oneOf("enter", "exit"), node: str });
    else
      o.push(
        `${at}: expected an event pattern (moved, created, destroyed, flipped, custom or flow)`,
      );
  };
  const trigger: Check = (v, at, o) =>
    fields(
      v,
      at,
      o,
      { id: str, on: pattern, flow: node },
      { when: cond, priority: int },
    );

  fields(
    spec,
    "spec",
    out,
    {
      id: str,
      version: int,
      players: (v, at, o) => fields(v, at, o, { min: int, max: int }),
      zones: record(zone),
      flow: node,
    },
    {
      vars: record((v, at, o) =>
        fields(
          v,
          at,
          o,
          {},
          { visibility: oneOf("public", "hidden", "owner") },
        ),
      ),
      subflows: record(node),
      triggers: list(trigger),
      triggerOrder: oneOf("fifo", "lifo"),
    },
  );
  return out;
}

function list(each: Check): Check {
  return (v, at, out) => {
    if (!Array.isArray(v)) {
      out.push(`${at}: expected an array`);
      return;
    }
    v.forEach((x, i) => each(x, `${at}[${i}]`, out));
  };
}
