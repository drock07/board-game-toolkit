import { interrupt, isReady, triggered } from "./effects.js";
import {
  FlowEndedWithoutEndError,
  FlowStuckError,
  UnhandledOutcomeError,
} from "./errors.js";
import {
  fiberIds,
  isInterrupt,
  kindOf,
  mayMove,
  nodeOf,
  pausedBy,
  reader,
  stackOf,
  withStack,
} from "./frames.js";
import { transact } from "./tx.js";
import {
  isExit,
  ROOT,
  type Fiber,
  type FiberId,
  type Frame,
  type GameDef,
  type GameEvent,
  type KindCtx,
  type Next,
  type State,
} from "./types.js";

export const MAX_STEPS = 10_000;

export function contextFor<V>(
  game: GameDef<V>,
  state: State<V>,
  log: GameEvent<V>[],
  fiber: FiberId,
): KindCtx<V> {
  const ctx: KindCtx<V> = {
    game,
    state,
    holds: (cond) =>
      game.impl.conditions[cond]!(reader(game, ctx.state, fiber)),
    query: (name) => game.impl.queries[name]!(reader(game, ctx.state, fiber)),
    transact: (body) => {
      let out: unknown;
      ctx.state = transact(game, ctx.state, log, fiber, (tx) => {
        out = body(tx);
      });
      return out as never;
    },
    fire: (event, timing) => {
      const hits = triggered(
        game,
        ctx.state,
        [event as GameEvent<V>],
        fiber,
        timing,
        false,
      );
      if (hits.length)
        ctx.state = { ...ctx.state, pending: [...hits, ...ctx.state.pending] };
    },
  };
  return ctx;
}

/** Removes a fiber and every fiber descended from it. */
export function cancelFiber<V>(s: State<V>, id: FiberId): State<V> {
  const fibers = { ...s.fibers };
  const drop = (fid: FiberId) => {
    for (const f of Object.values(fibers)) if (f.parent === fid) drop(f.id);
    delete fibers[fid];
  };
  drop(id);
  return { ...s, fibers };
}

/** Cancels the child fibers of frames that are being removed. */
export function cancelChildrenOf<V>(s: State<V>, frames: Frame[]): State<V> {
  let out = s;
  for (const f of frames)
    for (const c of f.children ?? []) out = cancelFiber(out, c);
  return out;
}

/** A child fiber whose stack ran out is finished: remove it and let its parent frame know. */
export function finishFiber<V>(s: State<V>, fiber: FiberId): State<V> {
  if (fiber === ROOT || stackOf(s, fiber).length > 0) return s;
  const { parent, at } = s.fibers[fiber]!;
  const { [fiber]: _gone, ...fibers } = s.fibers;
  const pstack = stackOf({ ...s, fibers }, parent);
  const pframe = pstack[at]!;
  const children = (pframe.children ?? []).filter((c) => c !== fiber);
  const { children: _c, ...bare } = pframe;
  const updated: Frame = children.length ? { ...bare, children } : bare;
  return withStack(
    { ...s, fibers },
    parent,
    pstack.map((f, i) => (i === at ? updated : f)),
  );
}

/**
 * Unwinds a raised outcome in `fiber`, whose raising frame is already
 * removed, to the nearest frame that catches it. An outcome that escapes a
 * child fiber cancels that fiber and its siblings and re-raises in the
 * parent, where the spawning frame gets first refusal.
 */
export function raise<V>(
  game: GameDef<V>,
  state: State<V>,
  log: GameEvent<V>[],
  fiber: FiberId,
  outcome: string,
): State<V> {
  let s = state;
  for (;;) {
    const stack = stackOf(s, fiber);
    if (!stack.length) {
      if (fiber === ROOT)
        throw new UnhandledOutcomeError(
          `Outcome "${outcome}" was raised but no enclosing node handles it`,
        );
      const { parent, at } = s.fibers[fiber]!;
      const pstack = stackOf(s, parent);
      const { children: _c, ...spawner } = pstack[at]!;
      for (const c of pstack[at]!.children ?? []) s = cancelFiber(s, c);
      s = withStack(s, parent, [...pstack.slice(0, at), spawner]);
      return raise(game, s, log, parent, outcome);
    }
    const top = stack.at(-1)!;
    const node = nodeOf(game, top.id);
    const kind = kindOf(game, node);
    if (kind.catches?.(node, top, outcome)) {
      const frame = { ...top };
      const ctx = contextFor(game, s, log, fiber);
      const next = kind.exited!(node, frame, outcome, ctx as KindCtx<unknown>);
      return advance(game, ctx.state, log, fiber, frame, next);
    }
    s = cancelChildrenOf(withStack(s, fiber, stack.slice(0, -1)), [top]);
  }
}

/** Applies a kind's verdict to a fiber's stack; `frame` is its top frame as the kind left it. */
export function advance<V>(
  game: GameDef<V>,
  s: State<V>,
  log: GameEvent<V>[],
  fiber: FiberId,
  frame: Frame,
  next: Next,
): State<V> {
  const rest = stackOf(s, fiber).slice(0, -1);
  if (next === "wait") return withStack(s, fiber, [...rest, frame]);
  if (next === "done") return finishFiber(withStack(s, fiber, rest), fiber);
  if (isExit(next))
    return raise(game, withStack(s, fiber, rest), log, fiber, next.exit);
  if ("spawn" in next) {
    let out = s;
    const ids: FiberId[] = [];
    for (const { node, player } of next.spawn) {
      const id = `f${out.nextFiber}`;
      const child: Fiber = {
        id,
        parent: fiber,
        at: rest.length,
        stack: [{ id: node.id, i: 0 }],
        ...(player !== undefined && { player }),
      };
      out = {
        ...out,
        nextFiber: out.nextFiber + 1,
        fibers: { ...out.fibers, [id]: child },
      };
      ids.push(id);
    }
    return withStack(out, fiber, [
      ...rest,
      { ...frame, i: frame.i + 1, children: ids },
    ]);
  }
  return withStack(s, fiber, [
    ...rest,
    { ...frame, i: frame.i + 1 },
    { id: next.pass.id, i: 0 },
  ]);
}

/** Runs every frame's guard, root fiber first and outermost first. The first that fires unwinds to its frame. */
export function guards<V>(
  game: GameDef<V>,
  s: State<V>,
  log: GameEvent<V>[],
): State<V> | undefined {
  for (const fiber of fiberIds(s)) {
    const stack = stackOf(s, fiber);
    for (let d = 0; d < stack.length; d++) {
      const top = stack[d]!;
      const node = nodeOf(game, top.id);
      const kind = kindOf(game, node);
      const outcome = kind.check?.(
        node,
        top,
        contextFor(game, s, log, fiber) as KindCtx<unknown>,
      );
      if (outcome === undefined) continue;
      // Cancel everything above the guard's frame (and any fibers under it),
      // except interrupts in flight: what happened still gets its reactions,
      // which finish before the outcome's handler
      const { children: _c, ...frame } = top;
      const first = stack.findIndex((f, i) => i > d && isInterrupt(game, f));
      const kept = first < 0 ? [] : stack.slice(first);
      const cancelled = stack.slice(d, first < 0 ? undefined : first);
      const cut = withStack(cancelChildrenOf(s, cancelled), fiber, [
        ...stack.slice(0, d),
        frame,
      ]);
      const ctx = contextFor(game, cut, log, fiber);
      const next = kind.exited!(node, frame, outcome, ctx as KindCtx<unknown>);
      const after = advance(game, ctx.state, log, fiber, frame, next);
      if (!kept.length || (fiber !== ROOT && !(fiber in after.fibers)))
        return after;
      return withStack(after, fiber, [...stackOf(after, fiber), ...kept]);
    }
  }
  return undefined;
}

/** Runs every runnable fiber until all are waiting or the game ends. Guards run before each step. */
export function settle<V>(
  game: GameDef<V>,
  state: State<V>,
  log: GameEvent<V>[],
): State<V> {
  let s = state;
  // The last nodes run, for a stuck flow's error
  const recent: string[] = [];
  for (let guard = 0; guard < MAX_STEPS; guard++) {
    if (s.status === "finished") return s;
    const fired = guards(game, s, log);
    if (fired) {
      s = fired;
      continue;
    }
    const paused = pausedBy(game, s);
    const ready = s.pending.findIndex((p) => isReady(game, s, p, paused));
    if (ready >= 0) {
      s = interrupt(game, s, ready);
      continue;
    }
    let ran = false;
    for (const fiber of fiberIds(s)) {
      if (!mayMove(s, fiber, paused)) continue;
      const stack = stackOf(s, fiber);
      if (!stack.length) {
        if (fiber === ROOT)
          throw new FlowEndedWithoutEndError(
            "The flow finished without ending the game: call tx.end() in a last step",
          );
        s = finishFiber(s, fiber);
        ran = true;
        break;
      }
      const top = stack.at(-1)!;
      if (top.children?.length) continue; // blocked on its children
      const node = nodeOf(game, top.id);
      const kind = kindOf(game, node);
      if (kind.actions) continue; // waiting for input
      const frame = { ...top };
      recent.push(node.id);
      if (recent.length > 12) recent.shift();
      const ctx = contextFor(game, s, log, fiber);
      const next = kind.run(node, frame, ctx as KindCtx<unknown>);
      s = ctx.state;
      if (s.status === "finished") return s;
      s = advance(game, s, log, fiber, frame, next);
      ran = true;
      break;
    }
    if (!ran) return s;
  }
  throw new FlowStuckError(
    `The flow ran ${MAX_STEPS} steps without waiting for input`,
    recent,
  );
}
