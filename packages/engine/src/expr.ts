import { GameDefinitionError } from "./errors.js";
import type { StateReader } from "./impl.js";
import { jsonEqual, type Json } from "./json.js";
import type { GameSpec } from "./spec.js";
import type { Scope } from "./types.js";

/**
 * A small JSON-only language for conditions that don't need code.
 *
 * Operands are literals or expressions: a plain object operand is always read
 * as an expression, while strings, numbers, booleans, null and arrays are
 * literals. Inside an expression, strings are never impl refs; use `ref`.
 */
export type Expr =
  /** A path into state: `"vars.enemy.hp"`, `"local.rolls"`, `"scope.player"`. Missing paths are null. */
  | { readonly var: string }
  /**
   * The number of entities in a zone. `$player` is replaced with
   * `scope.player` and `$item` with `scope.item`: `"patternLine:$player:$item"`.
   */
  | { readonly count: string }
  | { readonly eq: readonly [Operand, Operand] }
  | { readonly ne: readonly [Operand, Operand] }
  | { readonly lt: readonly [Operand, Operand] }
  | { readonly lte: readonly [Operand, Operand] }
  | { readonly gt: readonly [Operand, Operand] }
  | { readonly gte: readonly [Operand, Operand] }
  | { readonly and: readonly Operand[] }
  | { readonly or: readonly Operand[] }
  | { readonly not: Operand }
  | { readonly add: readonly [Operand, Operand] }
  | { readonly sub: readonly [Operand, Operand] }
  /** Calls an `impl.conditions` entry. */
  | { readonly ref: string };

export type Operand = Expr | string | number | boolean | null | readonly Json[];

const COMPARE = ["eq", "ne", "lt", "lte", "gt", "gte"] as const;
const ARITH = ["add", "sub"] as const;
const OPERATORS = [
  "var",
  "count",
  ...COMPARE,
  "and",
  "or",
  "not",
  ...ARITH,
  "ref",
] as const;
type Operator = (typeof OPERATORS)[number];

const SCOPE_KEYS = new Set(["player", "item", "iteration", "actor", "event"]);
const ROOTS = new Set(["vars", "local", "scope"]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The expression's one operator key. Assumes the expression is valid. */
const opOf = (e: Expr) => Object.keys(e)[0] as Operator;

/**
 * Problems with an expression's shape, as messages that start with `where`.
 * Checks operator arity, path roots, declared vars and zone names.
 */
export function checkExpr(
  e: unknown,
  where: string,
  spec: Pick<GameSpec, "vars" | "zones">,
): string[] {
  const problems: string[] = [];
  const operand = (v: unknown, at: string) => {
    if (isObject(v)) walk(v, at);
  };
  const pair = (v: unknown, at: string, op: string) => {
    if (!Array.isArray(v) || v.length !== 2) {
      problems.push(`${at}: ${op} takes two operands`);
      return;
    }
    v.forEach((x, i) => operand(x, `${at}[${i}]`));
  };
  const walk = (x: Record<string, unknown>, at: string) => {
    const keys = Object.keys(x);
    const op = keys[0] as Operator;
    if (keys.length !== 1 || !OPERATORS.includes(op)) {
      problems.push(
        `${at}: an expression has exactly one operator (${OPERATORS.join(", ")}), got {${keys.join(", ")}}`,
      );
      return;
    }
    const v = x[op];
    const sub = `${at}.${op}`;
    switch (op) {
      case "var": {
        if (typeof v !== "string") {
          problems.push(`${sub}: must be a path string`);
          break;
        }
        const [root, key] = v.split(".");
        if (!ROOTS.has(root!)) {
          problems.push(
            `${sub}: "${v}" must start with vars., local. or scope.`,
          );
        } else if (root !== "local" && !key) {
          problems.push(`${sub}: "${v}" needs a key after ${root}.`);
        } else if (root === "vars" && spec.vars && !(key! in spec.vars)) {
          problems.push(`${sub}: "${v}" names undeclared var "${key}"`);
        } else if (root === "scope" && !SCOPE_KEYS.has(key!)) {
          problems.push(
            `${sub}: "${v}": scope has ${[...SCOPE_KEYS].join(", ")}`,
          );
        }
        break;
      }
      case "count": {
        if (typeof v !== "string") {
          problems.push(`${sub}: must be a zone id`);
          break;
        }
        const def = v.split(":")[0]!;
        if (!(def in spec.zones))
          problems.push(`${sub}: "${v}" names unknown zone "${def}"`);
        break;
      }
      case "ref":
        if (typeof v !== "string")
          problems.push(`${sub}: must be a condition name`);
        break;
      case "and":
      case "or":
        if (!Array.isArray(v) || v.length === 0) {
          problems.push(`${sub}: takes a non-empty list`);
          break;
        }
        v.forEach((y, i) => operand(y, `${sub}[${i}]`));
        break;
      case "not":
        operand(v, sub);
        break;
      default:
        pair(v, sub, op);
    }
  };
  if (typeof e === "string") return problems;
  if (!isObject(e)) {
    problems.push(`${where}: a condition is a name or an expression`);
    return problems;
  }
  walk(e, where);
  return problems;
}

/** The `impl.conditions` names a condition uses. */
export function condRefs(c: string | Expr): string[] {
  if (typeof c === "string") return [c];
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObject(v)) {
      if (typeof v.ref === "string" && Object.keys(v).length === 1)
        out.push(v.ref);
      // Only operator operands can hold refs; var and count hold strings
      else if (!("var" in v) && !("count" in v)) Object.values(v).forEach(walk);
    }
  };
  walk(c);
  return out;
}

export interface ExprContext {
  reader: StateReader;
  scope: Scope;
  /** Evaluates an `impl.conditions` entry. */
  cond: (name: string) => boolean;
}

function path(value: unknown, keys: string[]): Json {
  let v = value;
  for (const k of keys) {
    if (v === null || typeof v !== "object") return null;
    v = (v as Record<string, unknown>)[k];
  }
  return v === undefined ? null : (v as Json);
}

/** Evaluates an expression operand. */
export function evalExpr(x: Operand, ctx: ExprContext): Json {
  if (!isObject(x)) return x as Json;
  const e = x;
  const fail = (msg: string): never => {
    throw new GameDefinitionError(`Expression ${describeCond(e)}: ${msg}`);
  };
  const num = (v: Operand) => {
    const n = evalExpr(v, ctx);
    return typeof n === "number"
      ? n
      : fail(`expected a number, got ${JSON.stringify(n)}`);
  };
  const bool = (v: Operand) => {
    const b = evalExpr(v, ctx);
    return typeof b === "boolean"
      ? b
      : fail(`expected true or false, got ${JSON.stringify(b)}`);
  };
  if ("var" in e) {
    const [root, ...rest] = e.var.split(".");
    if (root === "vars") return path(ctx.reader.vars, rest);
    if (root === "scope") return path(ctx.scope, rest);
    return path(ctx.reader.local(), rest);
  }
  if ("count" in e) {
    let zone = e.count;
    if (zone.includes("$player")) {
      if (ctx.scope.player === undefined)
        fail("$player needs an enclosing each over players");
      zone = zone.replaceAll("$player", ctx.scope.player!);
    }
    if (zone.includes("$item")) {
      const { item } = ctx.scope;
      if (typeof item !== "string" && typeof item !== "number")
        return fail(
          `$item needs an enclosing each over a ref whose items are strings or numbers, got ${JSON.stringify(item ?? null)}`,
        );
      zone = zone.replaceAll("$item", String(item));
    }
    return ctx.reader.count(zone);
  }
  if ("ref" in e) return ctx.cond(e.ref);
  if ("eq" in e)
    return jsonEqual(evalExpr(e.eq[0], ctx), evalExpr(e.eq[1], ctx));
  if ("ne" in e)
    return !jsonEqual(evalExpr(e.ne[0], ctx), evalExpr(e.ne[1], ctx));
  if ("lt" in e) return num(e.lt[0]) < num(e.lt[1]);
  if ("lte" in e) return num(e.lte[0]) <= num(e.lte[1]);
  if ("gt" in e) return num(e.gt[0]) > num(e.gt[1]);
  if ("gte" in e) return num(e.gte[0]) >= num(e.gte[1]);
  if ("add" in e) return num(e.add[0]) + num(e.add[1]);
  if ("sub" in e) return num(e.sub[0]) - num(e.sub[1]);
  if ("and" in e) return e.and.every(bool);
  if ("or" in e) return e.or.some(bool);
  if ("not" in e) return !bool(e.not);
  return fail("unknown operator");
}

/** Evaluates a condition expression; its result must be true or false. */
export function evalCondExpr(e: Expr, ctx: ExprContext): boolean {
  const v = evalExpr(e, ctx);
  if (typeof v !== "boolean") {
    throw new GameDefinitionError(
      `Condition ${describeCond(e)} gave ${JSON.stringify(v)}, not true or false`,
    );
  }
  return v;
}

const SYMBOL: Record<string, string> = {
  eq: "==",
  ne: "!=",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  add: "+",
  sub: "-",
};

/**
 * A condition as readable text, e.g. `vars.enemy.hp <= 0 and not wounded`.
 * Names of impl conditions print bare.
 */
export function describeCond(c: string | Operand): string {
  if (typeof c === "string") return c;
  const lit = (v: unknown) => JSON.stringify(v);
  const go = (v: Operand, top = false): string => {
    if (!isObject(v)) return lit(v);
    const op = opOf(v);
    const arg = (v as Record<string, unknown>)[op];
    const wrap = (s: string) => (top ? s : `(${s})`);
    switch (op) {
      case "var":
      case "ref":
        return arg as string;
      case "count":
        return `count(${arg as string})`;
      case "not":
        return `not ${go(arg as Operand)}`;
      case "and":
      case "or":
        return wrap((arg as Operand[]).map((x) => go(x)).join(` ${op} `));
      default: {
        const [a, b] = arg as [Operand, Operand];
        return wrap(`${go(a)} ${SYMBOL[op]} ${go(b)}`);
      }
    }
  };
  return go(c, true);
}
