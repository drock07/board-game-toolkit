/**
 * JSON values. Game state, vars, locals, entity props and event payloads are
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

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Structural equality for JSON values. Missing and `undefined` keys are equal. */
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
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!jsonEqual(ao[k], bo[k])) return false;
  return true;
}
