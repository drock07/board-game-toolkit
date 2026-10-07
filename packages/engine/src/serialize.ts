// Saving and loading. A spec is JSON already, and so is a state; these add a
// format marker, and stamp a save with a hash of the spec so a state from an
// incompatible build of the game fails clearly instead of deep in the flow.
import { stableStringify } from "./json.js";
import { apply, init, type InitOptions } from "./play.js";
import { cyrb128 } from "./rng.js";
import type { GameDef, Input, Spec, State } from "./types.js";

export const SPEC_FORMAT = "board-game-toolkit/spec";
export const SAVE_FORMAT = "board-game-toolkit/save";
export const FORMAT_VERSION = 2;

/** Reading a spec or a save failed: not one, a newer format, or from another build of the game. */
export class SaveError extends Error {
  override name = "SaveError";
}

/** A short, stable hash of any JSON value. */
export function hashJson(value: unknown): string {
  return cyrb128(stableStringify(value))
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
}

/**
 * A hash of the game's spec: its zones, flow, abilities and effects by
 * node id. A save only loads into a game with the same hash. Changes inside
 * rules code (a step's body, an action's `execute`) don't change it.
 */
export function specHash<V>(game: GameDef<V>): string {
  return hashJson(game.spec);
}

interface Document<T> {
  format: string;
  formatVersion: number;
  body: T;
}

function read<T>(text: string, format: string): T {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new SaveError(`Not JSON: ${(e as Error).message}`);
  }
  const d = doc as Partial<Document<T>> | null;
  if (!d || typeof d !== "object" || d.format !== format)
    throw new SaveError(`Not a ${format} document`);
  if (d.formatVersion !== FORMAT_VERSION)
    throw new SaveError(
      `${format} version ${JSON.stringify(d.formatVersion)} isn't supported (this engine reads ${FORMAT_VERSION})`,
    );
  return d.body as T;
}

const write = <T>(format: string, body: T): string =>
  JSON.stringify({ format, formatVersion: FORMAT_VERSION, body }) + "\n";

/** The spec as a JSON document, for tools that draw or diff a game. It can't run without its rules code. */
export function toJSON(spec: Spec): string {
  return write(SPEC_FORMAT, spec);
}

/** Reads a spec written by `toJSON`. */
export function fromJSON(text: string): Spec {
  const spec = read<Spec>(text, SPEC_FORMAT);
  if (!spec || typeof spec !== "object" || !spec.flow || !spec.zones)
    throw new SaveError("The document has no spec");
  return spec;
}

interface Save<V> {
  spec: string;
  state: State<V>;
}

/** A state as a JSON document, stamped with the game's spec hash. */
export function save<V>(game: GameDef<V>, state: State<V>): string {
  return write<Save<V>>(SAVE_FORMAT, { spec: specHash(game), state });
}

/** Reads a save written by `save` for this game. */
export function load<V>(game: GameDef<V>, text: string): State<V> {
  const body = read<Save<V>>(text, SAVE_FORMAT);
  if (body?.spec !== specHash(game))
    throw new SaveError(
      "This save is from a different version of the game (its spec hash doesn't match)",
    );
  return body.state;
}

/**
 * Plays `inputs` from the start, as a host would to rebuild a game from its
 * log. Every input must be legal; the first that isn't throws a `SaveError`
 * with its index and reason.
 */
export function replayInputs<V>(
  game: GameDef<V>,
  opts: InitOptions,
  inputs: readonly Input[],
): State<V> {
  let s = init(game, opts);
  inputs.forEach((input, i) => {
    const out = apply(game, s, input);
    if (!out.ok)
      throw new SaveError(
        `Input ${i} (${input.action} by ${input.player}) was rejected: ${out.reason}`,
      );
    s = out.state;
  });
  return s;
}
