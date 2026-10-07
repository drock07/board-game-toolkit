// The authoring API: declare a game's box (entity types, zones), its rules
// and flow with `define`, then run it with `init`/`apply` and show it with
// `view`/`viewEvents`. Custom node kinds are written against `./kinds`.

// Authoring
export { define } from "./define/define.js";
export { entity, event, zone } from "./define/handles.js";
export type {
  AnyZone,
  CountedZone,
  Effect,
  EntityType,
  EventType,
  PerPlayerCountedZone,
  PerPlayerZone,
  SharedZone,
  ZoneFamily,
  ZoneRef,
} from "./define/handles.js";
export { defaultNodes } from "./define/nodes.js";
export type {
  Ability,
  Action,
  ActionDef,
  ActionLike,
  ActionResult,
  ActionsIn,
  AnyoneBuilder,
  BranchBuilder,
  Core,
  EveryoneBuilder,
  Fired,
  Game,
  GameInput,
  Input,
  InputOf,
  LoopBuilder,
  Node,
  NodeBuilders,
  OutcomesBuilder,
  PlainActionDef,
  PromptBuilder,
  Reader,
  SeqBuilder,
  SimultaneousBuilder,
  StepBuilder,
  Trigger,
  TurnsBuilder,
  Tx,
} from "./define/types.js";

// Running and viewing
export {
  actors,
  apply,
  check,
  current,
  init,
  legalInputs,
  replay,
  view,
  viewEvents,
} from "./define/play.js";
export type { InitOptions } from "./play.js";
export { canSee } from "./zones.js";

// The engine's data
export type {
  Applied,
  DeepReadonly,
  Entity,
  EntityId,
  Exit,
  GameEvent,
  HiddenEntity,
  MoveOptions,
  PlayerId,
  Ref,
  Spec,
  State,
  View,
  ViewEvent,
  Visibility,
  ZoneId,
} from "./types.js";
