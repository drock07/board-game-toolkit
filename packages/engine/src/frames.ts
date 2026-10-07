import { GameDefinitionError, RulesError } from "./errors.js";
import {
  ROOT,
  type AbilityNode,
  type DeepReadonly,
  type Fiber,
  type FiberId,
  type Frame,
  type GameDef,
  type Kind,
  type Node,
  type PlayerId,
  type ReadCtx,
  type Reader,
  type State,
} from "./types.js";
import { entitiesOf, entityOf, itemsOf, zonesOf } from "./zones.js";

// --- Helpers ----------------------------------------------------------------

export function kindOf<V>(game: GameDef<V>, node: Node): Kind {
  const kind = game.kinds[node.kind];
  if (!kind)
    throw new GameDefinitionError(
      `Node "${node.id}" has unknown kind "${node.kind}"`,
    );
  return kind;
}

export function index<V>(
  game: GameDef<V>,
  node: Node,
  into = new Map<string, Node>(),
): Map<string, Node> {
  if (into.has(node.id))
    throw new GameDefinitionError(`Duplicate node id "${node.id}"`);
  into.set(node.id, node);
  for (const child of kindOf(game, node).children(node))
    index(game, child, into);
  return into;
}

const indexes = new WeakMap<object, Map<string, Node>>();

/** Every node by id: the flow, each ability and each effect. Built once per game. */
export function indexAll<V>(game: GameDef<V>): Map<string, Node> {
  const known = indexes.get(game);
  if (known) return known;
  const into = index(game, game.spec.flow);
  for (const a of game.spec.abilities ?? []) index(game, a, into);
  for (const e of game.spec.effects ?? []) index(game, e, into);
  indexes.set(game, into);
  return into;
}

export function nodeOf<V>(game: GameDef<V>, id: string): Node {
  const node = indexAll(game).get(id);
  if (!node)
    throw new RulesError(
      `Unknown node "${id}": is this state from another version of the game?`,
    );
  return node;
}

export function reader<V>(
  game: GameDef<V>,
  state: State<V>,
  fiber: FiberId = ROOT,
): Reader<V> {
  return {
    players: state.players,
    vars: state.vars as DeepReadonly<V>,
    // Lazy: kinds' actor hooks get a reader, and must not recurse into this
    get actor() {
      return boundActor(game, state, fiber);
    },
    scopeOf: (node) => scopeOf(game, state, fiber, node),
    entities: (zone) => entitiesOf(state, zone),
    count: (zone) => itemsOf(state, zone).length,
    zones: (family, player) => zonesOf(game, state, family, player),
    entity: (id) => entityOf(state, id),
  };
}

export function stackOf<V>(s: State<V>, fiber: FiberId): Frame[] {
  return fiber === ROOT ? s.flow : s.fibers[fiber]!.stack;
}

export function withStack<V>(
  s: State<V>,
  fiber: FiberId,
  stack: Frame[],
): State<V> {
  if (fiber === ROOT) return { ...s, flow: stack };
  return {
    ...s,
    fibers: { ...s.fibers, [fiber]: { ...s.fibers[fiber]!, stack } },
  };
}

/** Every fiber, root first, then children in creation order. */
export const fiberIds = <V>(s: State<V>): FiberId[] => [
  ROOT,
  ...Object.keys(s.fibers),
];

export interface FrameAt {
  fiber: FiberId;
  index: number;
  frame: Frame;
}

/** A fiber's frames, innermost first, then its parent's from the spawning frame down. */
export function framesOutAt<V>(s: State<V>, fiber: FiberId): FrameAt[] {
  const out: FrameAt[] = [];
  let at: FiberId | undefined = fiber;
  let below = Infinity;
  while (at !== undefined) {
    const stack = stackOf(s, at);
    for (let d = Math.min(stack.length, below) - 1; d >= 0; d--)
      out.push({ fiber: at, index: d, frame: stack[d]! });
    if (at === ROOT) break;
    const f: Fiber = s.fibers[at]!;
    below = f.at + 1;
    at = f.parent;
  }
  return out;
}

export const framesOut = <V>(s: State<V>, fiber: FiberId): Frame[] =>
  framesOutAt(s, fiber).map((f) => f.frame);

/** Whether a frame is an interrupt the engine pushed: an ability's or an effect's. */
export function isInterrupt<V>(game: GameDef<V>, f: Frame): boolean {
  const kind = nodeOf(game, f.id).kind;
  return kind === "ability" || kind === "effect";
}

/** How deep an interrupt frame is nested; 0 for any other frame. */
export function depthOf<V>(game: GameDef<V>, f: Frame): number {
  return isInterrupt(game, f) ? (f.data as { depth: number }).depth : 0;
}

/** The nearest effect frame, looking out through parent fibers. */
export function nearestEffect<V>(
  game: GameDef<V>,
  s: State<V>,
  fiber: FiberId,
): FrameAt | undefined {
  return framesOutAt(s, fiber).find(
    (f) => nodeOf(game, f.frame.id).kind === "effect",
  );
}

/** The fiber running an ability that pauses everyone, if any. */
export function pausedBy<V>(
  game: GameDef<V>,
  s: State<V>,
): FiberId | undefined {
  for (const fiber of fiberIds(s))
    for (const f of stackOf(s, fiber)) {
      const node = nodeOf(game, f.id);
      if (node.kind === "ability" && (node as AbilityNode).pause === "everyone")
        return fiber;
    }
  return undefined;
}

/** Whether `fiber` may move while `paused` (if any) holds everyone else. */
export function mayMove<V>(
  s: State<V>,
  fiber: FiberId,
  paused?: FiberId,
): boolean {
  for (let at: FiberId | undefined = fiber; at !== undefined; ) {
    if (paused === undefined || at === paused) return true;
    at = at === ROOT ? undefined : s.fibers[at]?.parent;
  }
  return false;
}

/** The nearest bound actor in a fiber, else the fiber's player. */
export function boundActor<V>(
  game: GameDef<V>,
  state: State<V>,
  fiber: FiberId,
): PlayerId | undefined {
  const read = readCtx(game, state, fiber);
  for (const frame of [...stackOf(state, fiber)].reverse()) {
    const node = nodeOf(game, frame.id);
    const actor = kindOf(game, node).actor?.(
      node,
      frame,
      read as ReadCtx<unknown>,
    );
    if (actor !== undefined) return actor;
  }
  return state.fibers[fiber]?.player;
}

/** The nearest frame of node `id`, looking out through parent fibers. */
export function nearestFrame<V>(
  state: State<V>,
  fiber: FiberId,
  id: string,
): FrameAt | undefined {
  return framesOutAt(state, fiber).find((f) => f.frame.id === id);
}

/**
 * What the nearest frame of node `id` shows the nodes under it (its kind's
 * `scope`), or undefined outside one. Looking a scope up by its node, not
 * by nearness alone, keeps one kind's scope from hiding another's.
 */
export function scopeOf<V>(
  game: GameDef<V>,
  state: State<V>,
  fiber: FiberId,
  id: string,
): unknown {
  const at = nearestFrame(state, fiber, id);
  if (!at) return undefined;
  const node = nodeOf(game, id);
  return kindOf(game, node).scope?.(node, at.frame);
}

export function readCtx<V>(
  game: GameDef<V>,
  state: State<V>,
  fiber: FiberId,
): ReadCtx<V> {
  return {
    game,
    state,
    holds: (cond) => game.impl.conditions[cond]!(reader(game, state, fiber)),
    query: (name) => game.impl.queries[name]!(reader(game, state, fiber)),
  };
}
