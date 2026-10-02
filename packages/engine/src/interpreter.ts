import type { CompiledGame, CompiledNode } from "./compile.js";
import {
  FlowEndedWithoutEndError,
  FlowStuckError,
  GameDefinitionError,
  UnhandledOutcomeError,
} from "./errors.js";
import type { StateReader } from "./impl.js";
import type { Json } from "./json.js";
import { createReader } from "./reader.js";
import type { Actor, Cond, FlowNode } from "./spec.js";
import { openTx, type Tx } from "./tx.js";
import type {
  Binding,
  Fiber,
  Frame,
  GameEvent,
  GameEventBody,
  GameState,
  Input,
  NodeId,
  PlayerId,
  Prompt,
  Scope,
} from "./types.js";

/** What a node kind asks the interpreter to do next. */
export type Next =
  | { push: NodeId; binding?: Binding }
  | { end: string }
  | { block: true }
  | {
      spawn: { node: NodeId; binding?: Binding }[];
      join: "all" | "race";
    };

export type PromptSpec = Omit<Prompt, "id" | "node">;

export type InputErrorCode =
  | "stale_prompt"
  | "not_actor"
  | "unknown_action"
  | "invalid_args"
  | "validation_failed"
  | "bad_selection"
  | "game_finished";

export interface InputError {
  code: InputErrorCode;
  message: string;
}

export function inputError(code: InputErrorCode, message: string): InputError {
  return { code, message };
}

export function isInputError(x: unknown): x is InputError {
  return typeof x === "object" && x !== null && "code" in x;
}

/** What node kinds can see and do. Bound to one frame. */
export interface KindCtx {
  readonly state: GameState;
  readonly game: CompiledGame;
  readonly compiled: CompiledNode;
  readonly scope: Scope;
  reader(): StateReader;
  cond(c: Cond): boolean;
  actors(actor: Actor): PlayerId[];
  list(ref: string): Json[];
  /** Runs rules code in a transaction and commits it. */
  tx(fn: (tx: Tx) => void, actor?: PlayerId): void;
}

/**
 * A flow node kind. Also the extension point for custom kinds, such as an
 * auction or a trick-taking round.
 */
export interface NodeKind<N extends FlowNode = FlowNode> {
  enter(ctx: KindCtx, frame: Frame, node: N): Next;
  childEnded(ctx: KindCtx, frame: Frame, node: N, outcome: string): Next;
  input?(ctx: KindCtx, frame: Frame, node: N, input: Input): Next | InputError;
  prompt?(ctx: KindCtx, frame: Frame, node: N): PromptSpec;
  cancel?(ctx: KindCtx, frame: Frame, node: N): void;
  /** Every legal input `player` could give this frame's open prompt. May be partial. */
  legal?(ctx: KindCtx, frame: Frame, node: N, player: PlayerId): Input[];
}

export type KindTable = ReadonlyMap<string, NodeKind<never>>;

export const MAX_STEPS = 10_000;

function fiberOrder(a: Fiber, b: Fiber) {
  return Number(a.id.slice(1)) - Number(b.id.slice(1));
}

/**
 * Runs the flow for one `init` or `apply`. Works on its own copy of `meta`
 * and `flow`; everything else changes only through committed transactions.
 */
export class Runtime {
  state: GameState;
  readonly events: GameEvent[] = [];
  private guardsDirty = true;
  private pendingExit: string | undefined;
  private readonly trace: string[] = [];

  /**
   * `readOnly` skips copying the flow, for queries like `legalInputs` that
   * never change it.
   */
  constructor(
    readonly game: CompiledGame,
    readonly kinds: KindTable,
    state: GameState,
    readOnly = false,
  ) {
    this.state = readOnly ? state : this.adopt(state);
  }

  private adopt(state: GameState): GameState {
    return {
      ...state,
      meta: { ...state.meta },
      flow: structuredClone(state.flow),
    };
  }

  /**
   * Takes a committed transaction's state while keeping the live flow object,
   * so frames held by handlers stay valid. Transactions only change flow
   * through locals, which are copied back.
   */
  private adoptTx(state: GameState, base: GameState) {
    const live = this.state.flow;
    for (const [id, fiber] of Object.entries(state.flow.fibers)) {
      fiber.stack.forEach((frame, i) => {
        if (frame.locals !== base.flow.fibers[id]?.stack[i]?.locals) {
          live.fibers[id]!.stack[i]!.locals = structuredClone(frame.locals);
        }
      });
    }
    this.state = { ...state, meta: { ...state.meta }, flow: live };
  }

  // -------------------------------------------------------------------------
  // Context

  node(id: NodeId): CompiledNode {
    const n = this.game.nodes.get(id);
    if (!n) throw new GameDefinitionError(`Unknown node "${id}"`);
    return n;
  }

  private kind(id: NodeId): NodeKind {
    const cn = this.node(id);
    const k = this.kinds.get(cn.node.kind);
    if (!k)
      throw new GameDefinitionError(`Unsupported node kind "${cn.node.kind}"`);
    return k;
  }

  fiber(id: string): Fiber {
    const f = this.state.flow.fibers[id];
    if (!f) throw new GameDefinitionError(`Unknown fiber "${id}"`);
    return f;
  }

  private scopeAt(f: Fiber, idx: number): Scope {
    const scope: Scope = {};
    for (let i = idx; i >= 0; i--) {
      const b = f.stack[i]?.binding;
      if (!b) continue;
      if (scope.player === undefined && b.player !== undefined)
        scope.player = b.player;
      if (scope.item === undefined && b.item !== undefined) scope.item = b.item;
      if (scope.iteration === undefined && b.iteration !== undefined) {
        scope.iteration = b.iteration;
      }
    }
    return scope;
  }

  /** The frame index holding the locals `tx.local(nodeId?)` refers to. */
  private localsFrame(f: Fiber, idx: number, nodeId?: NodeId): number {
    for (let i = idx; i >= 0; i--) {
      const frame = f.stack[i]!;
      if (
        nodeId === undefined
          ? frame.locals !== undefined
          : frame.node === nodeId
      ) {
        if (frame.locals === undefined) {
          throw new GameDefinitionError(`Node "${nodeId}" has no locals`);
        }
        return i;
      }
    }
    throw new GameDefinitionError(
      nodeId === undefined
        ? "No enclosing node has locals"
        : `No enclosing node "${nodeId}"`,
    );
  }

  private readerAt(f: Fiber, idx: number): StateReader {
    return createReader(this.state, (nodeId) => {
      return f.stack[this.localsFrame(f, idx, nodeId)]!.locals!;
    });
  }

  private evalCond(cond: Cond, f: Fiber, idx: number, scope?: Scope): boolean {
    const fn = this.game.impl.conditions?.[cond];
    if (!fn) throw new GameDefinitionError(`Missing impl.conditions.${cond}`);
    return fn(this.readerAt(f, idx), scope ?? this.scopeAt(f, idx));
  }

  ctx(f: Fiber, idx: number): KindCtx {
    const frame = f.stack[idx]!;
    const scope = this.scopeAt(f, idx);
    const compiled = this.node(frame.node);
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- captured by the context's methods
    const rt = this;
    const list = (ref: string): Json[] => {
      const fn = rt.game.impl.lists?.[ref];
      if (!fn) throw new GameDefinitionError(`Missing impl.lists.${ref}`);
      return fn(rt.readerAt(f, idx), scope);
    };
    return {
      get state() {
        return rt.state;
      },
      game: this.game,
      compiled,
      scope,
      reader: () => rt.readerAt(f, idx),
      cond: (c) => rt.evalCond(c, f, idx, scope),
      list,
      actors: (actor) => {
        const players = rt.state.players;
        let out: Json[];
        if (actor === "current") {
          if (scope.player === undefined) {
            throw new GameDefinitionError(
              `Node "${frame.node}" uses actor "current" outside an each over players`,
            );
          }
          out = [scope.player];
        } else if (actor === "any") out = [...players];
        else if (typeof actor === "object") out = list(actor.ref);
        else out = [actor];
        for (const p of out) {
          if (typeof p !== "string" || !players.includes(p)) {
            throw new GameDefinitionError(
              `Node "${frame.node}" resolved actor ${JSON.stringify(p)}, which is not a player`,
            );
          }
        }
        if (out.length === 0) {
          throw new GameDefinitionError(
            `Node "${frame.node}" resolved no actors`,
          );
        }
        return out as PlayerId[];
      },
      tx: (fn, actor) => rt.runTx(f, idx, fn, actor),
    };
  }

  // -------------------------------------------------------------------------
  // Transactions and events

  runTx(
    f: Fiber | undefined,
    idx: number,
    fn: (tx: Tx) => void,
    actor?: PlayerId,
  ) {
    const scope = f ? this.scopeAt(f, idx) : {};
    if (actor !== undefined) scope.actor = actor;
    const opts: Parameters<typeof openTx>[1] = { scope };
    if (f) {
      opts.locals = (nodeId) => {
        const i = this.localsFrame(f, idx, nodeId);
        return {
          node: f.stack[i]!.node,
          path: ["flow", "fibers", f.id, "stack", i, "locals"],
        };
      };
    }
    // Immer copies on write and doesn't freeze, so the live flow is safe to draft
    const base = this.state;
    const { tx, commit } = openTx(base, opts);
    fn(tx);
    const res = commit();
    this.events.push(...res.events);
    this.adoptTx(res.state, base);
    this.guardsDirty = true;
    if (res.exit !== undefined) this.pendingExit ??= res.exit;
    if (this.state.status === "finished") this.finish();
  }

  private emit(body: GameEventBody) {
    const meta = this.state.meta;
    this.events.push({
      seq: meta.eventCount++,
      input: meta.inputCount,
      ...body,
    });
  }

  private emitFlow(
    kind: "enter" | "exit" | "prompt" | "resolve",
    node: NodeId,
    outcome?: string,
  ) {
    const body: GameEventBody = { type: "flow", kind, node };
    if (outcome !== undefined) body.outcome = outcome;
    this.emit(body);
  }

  /** `tx.end` was called: cancel every fiber and stop. */
  private finish() {
    for (const f of Object.values(this.state.flow.fibers)) {
      f.stack = [];
      f.status = "done";
    }
  }

  // -------------------------------------------------------------------------
  // Frames

  push(f: Fiber, nodeId: NodeId, binding?: Binding) {
    const frame: Frame = { node: nodeId, phase: "new", data: null };
    if (binding) frame.binding = binding;
    f.stack.push(frame);
    const cn = this.node(nodeId);
    if (cn.node.locals) {
      // Locals are initialized on push, so guards checked before enter can read them
      const fn = this.game.impl.locals?.[cn.node.locals];
      if (!fn)
        throw new GameDefinitionError(`Missing impl.locals.${cn.node.locals}`);
      const idx = f.stack.length - 1;
      frame.locals = structuredClone(
        fn(this.readerAt(f, idx), this.scopeAt(f, idx)),
      );
    }
    this.guardsDirty = true;
  }

  /** Records a handler's result, or raises the outcome its `tx.exit` set. */
  private afterHandler(f: Fiber, frame: Frame, next: Next) {
    if (this.state.status === "finished") return;
    const exit = this.pendingExit;
    if (exit !== undefined) {
      this.pendingExit = undefined;
      this.endFrame(f, exit);
      return;
    }
    frame.next = next as Json;
  }

  /**
   * Ends the top frame with `outcome`. A frame that handles the outcome runs
   * its `on` flow or ends "done"; otherwise the outcome unwinds further.
   */
  private endFrame(f: Fiber, outcome: string) {
    f.status = "runnable";
    for (;;) {
      const top = f.stack.at(-1)!;
      const cn = this.node(top.node);
      delete top.next;
      delete top.prompt;
      this.emitFlow("exit", top.node, outcome);
      if (
        outcome !== "done" &&
        top.phase !== "handling" &&
        cn.handles.has(outcome)
      ) {
        const on = cn.node.on?.[outcome];
        if (on) {
          top.phase = "handling";
          this.push(f, on.id);
          return;
        }
        outcome = "done";
      } else if (outcome !== "done") {
        this.kind(top.node).cancel?.(
          this.ctx(f, f.stack.length - 1),
          top,
          cn.node,
        );
      }
      f.stack.pop();
      const parent = f.stack.at(-1);
      if (!parent) {
        this.fiberDone(f, outcome);
        return;
      }
      // A raised outcome keeps unwinding; a handling frame's `on` flow ending
      // ends that frame too
      if (outcome !== "done" || parent.phase === "handling") continue;
      const idx = f.stack.length - 1;
      const next = this.kind(parent.node).childEnded(
        this.ctx(f, idx),
        parent,
        this.node(parent.node).node,
        outcome,
      );
      this.afterHandler(f, parent, next);
      return;
    }
  }

  private fiberDone(f: Fiber, outcome: string) {
    f.status = "done";
    f.outcome = outcome;
    if (outcome !== "done" && !f.parent) {
      throw new UnhandledOutcomeError(
        `Outcome "${outcome}" reached the root of the flow without being handled`,
      );
    }
  }

  /** Pops every frame above `idx`, then ends that frame with `outcome`. */
  private unwindTo(f: Fiber, idx: number, outcome: string) {
    while (f.stack.length - 1 > idx) {
      const top = f.stack.at(-1)!;
      const cn = this.node(top.node);
      this.kind(top.node).cancel?.(
        this.ctx(f, f.stack.length - 1),
        top,
        cn.node,
      );
      this.emitFlow("exit", top.node);
      f.stack.pop();
    }
    this.endFrame(f, outcome);
  }

  private openPrompt(f: Fiber, frame: Frame) {
    const idx = f.stack.length - 1;
    const kind = this.kind(frame.node);
    if (!kind.prompt) {
      throw new GameDefinitionError(
        `Node "${frame.node}" blocked but has no prompt`,
      );
    }
    const spec = kind.prompt(
      this.ctx(f, idx),
      frame,
      this.node(frame.node).node,
    );
    const prompt: Prompt = {
      id: `q${this.state.flow.nextPromptId++}`,
      node: frame.node,
      ...spec,
    };
    for (const k of Object.keys(prompt) as (keyof Prompt)[]) {
      if (prompt[k] === undefined) delete prompt[k];
    }
    frame.prompt = prompt;
    f.status = "blocked";
    this.emitFlow("prompt", frame.node);
  }

  private applyNext(f: Fiber, next: Next) {
    if ("push" in next) this.push(f, next.push, next.binding);
    else if ("end" in next) this.endFrame(f, next.end);
    else if ("block" in next) this.openPrompt(f, f.stack.at(-1)!);
    else throw new GameDefinitionError("parallel flows are not supported yet");
  }

  private stepFiber(f: Fiber) {
    const idx = f.stack.length - 1;
    const top = f.stack[idx]!;
    this.trace.push(top.node);
    if (this.trace.length > 50) this.trace.shift();
    if (top.phase === "new") {
      top.phase = "active";
      this.emitFlow("enter", top.node);
      const next = this.kind(top.node).enter(
        this.ctx(f, idx),
        top,
        this.node(top.node).node,
      );
      this.afterHandler(f, top, next);
      return;
    }
    if (top.next === undefined) {
      throw new GameDefinitionError(
        `Fiber ${f.id} is runnable but "${top.node}" has nothing to do`,
      );
    }
    const next = top.next as Next;
    delete top.next;
    this.applyNext(f, next);
  }

  // -------------------------------------------------------------------------
  // Guards and settling

  /** Checks guards outermost first; unwinds the first match. */
  private checkGuards(): boolean {
    const fibers = Object.values(this.state.flow.fibers).sort(fiberOrder);
    for (const f of fibers) {
      if (f.status === "done") continue;
      for (let i = 0; i < f.stack.length; i++) {
        const frame = f.stack[i]!;
        if (frame.phase === "handling") continue;
        const exits = this.node(frame.node).node.exits;
        if (!exits) continue;
        for (const [outcome, cond] of Object.entries(exits)) {
          if (this.evalCond(cond, f, i)) {
            this.unwindTo(f, i, outcome);
            return true;
          }
        }
      }
    }
    return false;
  }

  settle() {
    let budget = MAX_STEPS;
    for (;;) {
      if (this.state.status === "finished") return;
      if (this.guardsDirty) {
        this.guardsDirty = false;
        if (this.checkGuards()) {
          this.guardsDirty = true;
          continue;
        }
      }
      const f = Object.values(this.state.flow.fibers)
        .filter((x) => x.status === "runnable")
        .sort(fiberOrder)[0];
      if (!f) break;
      this.stepFiber(f);
      if (--budget === 0) {
        throw new FlowStuckError(
          `The flow ran ${MAX_STEPS} steps without waiting for input (last node: "${this.trace.at(-1)}")`,
          [...this.trace],
        );
      }
    }
    const root = this.state.flow.fibers[this.state.flow.rootFiber];
    if (root?.status === "done") {
      throw new FlowEndedWithoutEndError(
        "The flow finished without calling tx.end(); wrap it in a loop or end the game in a step",
      );
    }
  }

  // -------------------------------------------------------------------------
  // Entry points

  start() {
    const flow = this.state.flow;
    const id = `f${flow.nextFiberId++}`;
    const fiber: Fiber = { id, stack: [], status: "runnable" };
    flow.fibers[id] = fiber;
    flow.rootFiber = id;
    this.push(fiber, this.game.root);
  }

  /** Finds the blocked frame a prompt belongs to. */
  findPrompt(promptId: string): { fiber: Fiber; frame: Frame } | undefined {
    for (const fiber of Object.values(this.state.flow.fibers)) {
      if (fiber.status !== "blocked") continue;
      const frame = fiber.stack.at(-1);
      if (frame?.prompt?.id === promptId) return { fiber, frame };
    }
    return undefined;
  }

  input(fiber: Fiber, frame: Frame, input: Input): InputError | undefined {
    const idx = fiber.stack.length - 1;
    const kind = this.kind(frame.node);
    if (!kind.input) {
      throw new GameDefinitionError(
        `Node "${frame.node}" has a prompt but takes no input`,
      );
    }
    this.state.meta.inputCount++;
    this.emitFlow("resolve", frame.node);
    fiber.status = "runnable";
    // The prompt stays on the frame while the kind validates against it
    const res = kind.input(
      this.ctx(fiber, idx),
      frame,
      this.node(frame.node).node,
      input,
    );
    delete frame.prompt;
    if (isInputError(res)) return res;
    this.guardsDirty = true;
    this.afterHandler(fiber, frame, res);
    return undefined;
  }

  /** Every legal input `player` could give right now, across open prompts. */
  legalInputs(player: PlayerId): Input[] {
    const out: Input[] = [];
    const fibers = Object.values(this.state.flow.fibers).sort(fiberOrder);
    for (const fiber of fibers) {
      const frame = fiber.stack.at(-1);
      if (fiber.status !== "blocked" || !frame?.prompt) continue;
      if (!frame.prompt.actors.includes(player)) continue;
      const kind = this.kind(frame.node);
      const ctx = this.ctx(fiber, fiber.stack.length - 1);
      out.push(
        ...(kind.legal?.(ctx, frame, this.node(frame.node).node, player) ?? []),
      );
    }
    return out;
  }
}
