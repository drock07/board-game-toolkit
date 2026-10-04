import type { Expr } from "./expr.js";
import type { Json } from "./json.js";
import type { NodeId, PlayerId } from "./types.js";

/** A condition: the name of an `impl.conditions` entry, or an expression. */
export type Cond = string | Expr;

/**
 * Who may answer a prompt. "current" is the player bound by the nearest
 * enclosing `each` over players; "any" is every player; a `ref` names an
 * `impl.lists` entry that returns player ids.
 */
export type Actor =
  | "current"
  | "any"
  // A player id; `string & {}` keeps the literals above in autocomplete
  | (PlayerId & {})
  | { readonly ref: string };

export type Over =
  | {
      readonly players: "clockwise" | "counterclockwise";
      readonly from?: "first" | "random" | { readonly ref: string };
    }
  | { readonly ref: string };

export interface NodeCommon {
  readonly id: NodeId;
  /** `impl.locals` ref, run when the frame is pushed. */
  readonly locals?: string;
  /** Guards: the node ends with the outcome when its condition holds. */
  readonly exits?: { readonly [outcome: string]: Cond };
  /** Flow to run after this node ends with that outcome. */
  readonly on?: { readonly [outcome: string]: FlowNode };
}

export type CommonOptions = Omit<NodeCommon, "id">;

export interface SeqNode extends NodeCommon {
  readonly kind: "seq";
  readonly children: readonly FlowNode[];
}

export interface LoopNode extends NodeCommon {
  readonly kind: "loop";
  readonly body: FlowNode;
  readonly until?: Cond;
  readonly while?: Cond;
  readonly times?: number;
}

export interface EachNode extends NodeCommon {
  readonly kind: "each";
  readonly over: Over;
  readonly body: FlowNode;
  readonly mode?: "sequential" | "parallel";
  readonly until?: Cond;
  readonly repeat?: boolean;
}

export interface BranchNode extends NodeCommon {
  readonly kind: "branch";
  readonly cases: readonly { readonly when: Cond; readonly then: FlowNode }[];
  readonly else?: FlowNode;
}

export interface StepNode extends NodeCommon {
  readonly kind: "step";
  readonly run: string;
}

export interface DecisionAction {
  /** Whether the decision ends after this action. Defaults to true. */
  readonly ends?: boolean;
  /** Flow to run after the action executes. */
  readonly then?: FlowNode;
}

export interface DecisionNode extends NodeCommon {
  readonly kind: "decision";
  readonly actor: Actor;
  readonly actions: { readonly [name: string]: DecisionAction };
  /** Checked whenever the node would re-prompt. */
  readonly endWhen?: Cond;
}

export interface ChooseNode extends NodeCommon {
  readonly kind: "choose";
  readonly actor: Actor;
  /** An `impl.lists` ref, or literal options. */
  readonly options: string | readonly Json[];
  readonly min?: number;
  readonly max?: number;
  readonly apply: string;
}

export interface PauseNode extends NodeCommon {
  readonly kind: "pause";
  readonly actor?: Actor;
  readonly label?: string;
}

export interface ParallelNode extends NodeCommon {
  readonly kind: "parallel";
  readonly children: readonly FlowNode[];
  readonly join: "all" | "race";
}

export interface ExitNode extends NodeCommon {
  readonly kind: "exit";
  readonly outcome: string;
}

export interface UseNode extends NodeCommon {
  readonly kind: "use";
  readonly subflow: string;
}

export type FlowNode =
  | SeqNode
  | LoopNode
  | EachNode
  | BranchNode
  | StepNode
  | DecisionNode
  | ChooseNode
  | PauseNode
  | ParallelNode
  | ExitNode
  | UseNode;

export type FlowNodeKind = FlowNode["kind"];

export interface ZoneDef {
  /** Creates `<name>:<playerId>` for each player. */
  readonly perPlayer?: boolean;
  /**
   * Creates `<name>:<index>` for indexes `0` to `count - 1`, or
   * `<name>:<playerId>:<index>` with `perPlayer`. A `ref` names an
   * `impl.zoneCounts` entry, run once at `init`: the zone set is fixed for
   * the game.
   */
  readonly count?: number | { readonly ref: string };
  /** Defaults to true. */
  readonly ordered?: boolean;
  readonly visibility:
    | "public"
    | "hidden"
    | "owner"
    | "top"
    | { readonly ref: string };
  /** Hidden entities still show their type (e.g. differing card backs). */
  readonly revealType?: boolean;
}

/** "owner": the var is a `Record<PlayerId, …>` and each player sees only their key. */
export type VarVisibility = "public" | "hidden" | "owner";

export type EventPattern =
  | {
      readonly type: "moved";
      readonly from?: string;
      readonly to?: string;
      readonly entityType?: string;
    }
  | {
      readonly type: "created" | "destroyed" | "flipped";
      readonly entityType?: string;
    }
  | { readonly type: "custom"; readonly name: string }
  | {
      readonly type: "flow";
      readonly kind: "enter" | "exit";
      readonly node: NodeId;
    };

export interface TriggerDef {
  readonly id: string;
  readonly on: EventPattern;
  readonly when?: Cond;
  readonly flow: FlowNode;
  readonly priority?: number;
}

export interface GameSpec {
  readonly id: string;
  readonly version: number;
  readonly players: { readonly min: number; readonly max: number };
  readonly zones: { readonly [name: string]: ZoneDef };
  readonly vars?: {
    readonly [key: string]: { readonly visibility?: VarVisibility };
  };
  readonly flow: FlowNode;
  readonly subflows?: { readonly [name: string]: FlowNode };
  readonly triggers?: readonly TriggerDef[];
  readonly triggerOrder?: "fifo" | "lifo";
}
