// The built-in node kinds, as modules the engine runs through its registry.
// A custom kind is the same shape.
import type { Kind } from "../types.js";
import { branch, loop, outcomes, seq, step } from "./flow.js";
import { ability, effect } from "./interrupts.js";
import { turns } from "./turns.js";
import { anyone, prompt, simultaneous } from "./waiting.js";

export {
  ability,
  anyone,
  branch,
  effect,
  loop,
  outcomes,
  prompt,
  seq,
  simultaneous,
  step,
  turns,
};

export const builtinKinds: Record<string, Kind> = {
  seq,
  step,
  loop,
  turns,
  prompt,
  branch,
  outcomes,
  anyone,
  simultaneous,
  ability,
  effect,
};

// What a custom kind is written against
export { defineNode, node } from "../define/types.js";
export type { KindName, Lowerer, NodeDef } from "../define/types.js";
export { isExit, ROOT } from "../types.js";
export type {
  Answer,
  Exit,
  Frame,
  KindCtx,
  Next,
  ReadCtx,
  Spawn,
  Node as SpecNode,
} from "../types.js";
export type { Kind };
