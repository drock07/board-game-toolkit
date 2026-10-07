/**
 * JSON values. Game state, vars, entity props and effect data are
 * all plain JSON, so state can be saved, diffed and sent over the wire.
 *
 * Game-specific shapes are checked with `JsonCompatible` instead, which also
 * accepts interfaces (an interface never matches an index signature).
 */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/**
 * `T` with every part that isn't JSON replaced by `never`, so
 * `T extends JsonCompatible<T>` holds exactly when `T` is JSON-compatible.
 * Works for interfaces and type aliases alike.
 *
 * Rejects functions and anything with methods (Date, Map, Set, class
 * instances with methods), bigint, symbols, and required keys whose type
 * includes `undefined`. Optional keys are fine: absent isn't `undefined` in
 * JSON. A class with only data fields is structurally a plain object, so it
 * can't be told apart and passes.
 */
export type JsonCompatible<T> = [T] extends [Json]
  ? // Already JSON (including the recursive Json type itself, which would
    // otherwise recurse forever); only interfaces need the structural check
    T
  : // From here the checks distribute over unions, so primitives in a union
    // with an interface (Item | null) still need their own branch
    T extends string | number | boolean | null
    ? T
    : T extends (...args: never[]) => unknown
      ? never
      : T extends readonly unknown[]
        ? { [K in keyof T]: JsonCompatible<T[K]> }
        : T extends object
          ? {
              [K in keyof T]: K extends string
                ? // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends Pick` tests whether K is optional
                  {} extends Pick<T, K>
                  ? JsonCompatible<Exclude<T[K], undefined>>
                  : JsonCompatible<T[K]>
                : never;
            }
          : never;

/** `true` when `T` is JSON-compatible. */
export type IsJsonCompatible<T> = [T] extends [JsonCompatible<T>]
  ? true
  : false;

/** JSON with object keys sorted, so equal values always stringify equally. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

/** Structural equality for JSON values: key order doesn't matter, and a missing key equals an `undefined` one. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => jsonEqual(v, b[i]));
  }
  if (Array.isArray(b)) return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  for (const k in ao) if (!jsonEqual(ao[k], bo[k])) return false;
  for (const k in bo) if (!(k in ao) && bo[k] !== undefined) return false;
  return true;
}

/** Whether a value survives a JSON round trip unchanged: plain objects, arrays, strings, finite numbers, booleans and null. An object's `undefined` values are allowed (JSON drops them). */
export function isPlainJson(v: unknown): boolean {
  if (v === null || typeof v === "string" || typeof v === "boolean")
    return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(isPlainJson);
  if (typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(v).every((x) => x === undefined || isPlainJson(x));
}
