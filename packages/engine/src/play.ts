import {
  boundActor,
  fiberIds,
  indexAll,
  kindOf,
  mayMove,
  nodeOf,
  pausedBy,
  readCtx,
  reader,
  sameJson,
  stackOf,
} from "./frames.js";
import { seedRng } from "./rng.js";
import { advance, contextFor, settle } from "./run.js";
import { transact } from "./tx.js";
import {
  ROOT,
  type Applied,
  type EntityId,
  type FiberId,
  type Frame,
  type GameDef,
  type GameEvent,
  type Input,
  type Kind,
  type KindCtx,
  type Node,
  type PlayerId,
  type ReadCtx,
  type State,
  type ZoneId,
} from "./types.js";
import { zoneId } from "./zones.js";

export interface Waiting {
  fiber: FiberId;
  frame: Frame;
  node: Node;
  kind: Kind;
}

/** Every fiber whose top frame's kind is waiting for input. */
export function waitingFrames<V>(game: GameDef<V>, state: State<V>): Waiting[] {
  const out: Waiting[] = [];
  const paused = pausedBy(game, state);
  for (const fiber of fiberIds(state)) {
    if (!mayMove(state, fiber, paused)) continue;
    const frame = stackOf(state, fiber).at(-1);
    if (!frame || frame.children) continue;
    const node = nodeOf(game, frame.id);
    const kind = kindOf(game, node);
    if (kind.actions) out.push({ fiber, frame, node, kind });
  }
  return out;
}

/** Who may answer a waiting frame: its kind's actors, else the nearest bound actor, else the fiber's player, else the first seat. */
export function actorsOf<V>(
  game: GameDef<V>,
  state: State<V>,
  w: Waiting,
): PlayerId[] {
  if (w.kind.actors)
    return w.kind.actors(
      w.node,
      w.frame,
      readCtx(game, state, w.fiber) as ReadCtx<unknown>,
    );
  return [boundActor(game, state, w.fiber) ?? state.players[0]!];
}

/** The players who may act now: none unless the flow is waiting. */
export function actors<V>(game: GameDef<V>, state: State<V>): PlayerId[] {
  return [
    ...new Set(
      waitingFrames(game, state).flatMap((w) => actorsOf(game, state, w)),
    ),
  ];
}

/** The one player who may act now, for games where that's always one. */
export function current<V>(
  game: GameDef<V>,
  state: State<V>,
): PlayerId | undefined {
  return actors(game, state)[0];
}

/**
 * The waiting frame `player` answers: the one offering `action` when they
 * have several open (their own prompt and someone's reaction), else the first.
 */
export function waitingFor<V>(
  game: GameDef<V>,
  state: State<V>,
  player: PlayerId,
  action?: string,
): Waiting | undefined {
  const mine = waitingFrames(game, state).filter((w) =>
    actorsOf(game, state, w).includes(player),
  );
  return (
    mine.find((w) =>
      w.kind.actions!(w.node, w.frame, player).includes(action!),
    ) ?? mine[0]
  );
}

export function check<V>(
  game: GameDef<V>,
  state: State<V>,
  input: Input,
): true | string {
  if (state.status === "finished") return "The game has finished";
  if (!waitingFrames(game, state).length) return "No prompt is open";
  const w = waitingFor(game, state, input.player, input.action);
  if (!w) {
    const who = actors(game, state);
    return who.length === 1
      ? `It is ${who[0]}'s turn, not ${input.player}'s`
      : `${input.player} has nothing to do right now`;
  }
  const actions = w.kind.actions!(w.node, w.frame, input.player);
  if (!actions.includes(input.action))
    return `"${input.action}" is not an action of the current prompt`;
  const impl = game.impl.actions[input.action]!;
  const s = reader(game, state, w.fiber);
  if (impl.validate) return impl.validate(s, input.args, input.player);
  return impl.enumerate(s, input.player).some((a) => sameJson(a, input.args))
    ? true
    : "That move isn't available";
}

/** Every input `player` could give now, or every actor's when no player is given. */
export function legalInputs<V>(
  game: GameDef<V>,
  state: State<V>,
  player?: PlayerId,
): Input[] {
  if (state.status === "finished") return [];
  const out: Input[] = [];
  for (const w of waitingFrames(game, state)) {
    const s = reader(game, state, w.fiber);
    for (const p of actorsOf(game, state, w).filter(
      (a) => player === undefined || a === player,
    )) {
      for (const action of w.kind.actions!(w.node, w.frame, p)) {
        const impl = game.impl.actions[action]!;
        for (const args of impl.enumerate(s, p)) {
          if (!impl.validate || impl.validate(s, args, p) === true)
            out.push({ player: p, action, args });
        }
      }
    }
  }
  return out;
}

export interface InitOptions {
  players: PlayerId[];
  seed: string;
}

export function init<V>(game: GameDef<V>, opts: InitOptions): State<V> {
  const { min, max } = game.spec.players;
  if (opts.players.length < min || opts.players.length > max) {
    throw new Error(`This game takes ${min} to ${max} players`);
  }
  indexAll(game);
  const zones: Record<ZoneId, EntityId[]> = {};
  for (const [name, def] of Object.entries(game.spec.zones)) {
    const owners = def.perPlayer ? opts.players : [undefined];
    let indexes: (number | undefined)[] = [undefined];
    if (def.count !== undefined) {
      const n =
        typeof def.count === "number"
          ? def.count
          : game.impl.zoneCounts[def.count.ref]!(opts.players.length);
      indexes = Array.from({ length: n }, (_, i) => i);
    }
    for (const owner of owners)
      for (const index of indexes) zones[zoneId(name, owner, index)] = [];
  }
  const empty: State<V> = {
    players: opts.players,
    vars: undefined as V,
    rng: seedRng(opts.seed),
    entities: {},
    zones,
    nextEntity: 1,
    nextRef: 1,
    flow: [{ id: game.spec.flow.id, i: 0 }],
    fibers: {},
    nextFiber: 1,
    status: "running",
    inputs: 0,
    pending: [],
  };
  // Setup's events aren't returned: there is no state before it to replay onto
  const log: GameEvent<V>[] = [];
  return settle(
    game,
    transact(game, empty, log, ROOT, (tx) => game.impl.setup(tx)),
    log,
  );
}

/**
 * Applies one input: the new state and what happened, in order. An illegal
 * input is not an error; it comes back as `{ ok: false, reason }`.
 */
export function apply<V>(
  game: GameDef<V>,
  state: State<V>,
  input: Input,
): Applied<V> {
  const problem = check(game, state, input);
  if (problem !== true) return { ok: false, reason: problem };
  const w = waitingFor(game, state, input.player, input.action)!;
  const impl = game.impl.actions[input.action]!;
  const log: GameEvent<V>[] = [];
  let result: unknown;
  let next = transact(game, state, log, w.fiber, (tx) => {
    result = impl.execute(tx, input.args, input.player);
  });
  next.inputs++;
  if (next.status === "finished") return { ok: true, state: next, events: log };
  // The waiting kind sees the answer and decides whether to keep waiting
  const frame = { ...stackOf(next, w.fiber).at(-1)! };
  const ctx = contextFor(game, next, log, w.fiber);
  const verdict =
    w.kind.answered?.(
      w.node,
      frame,
      { player: input.player, action: input.action, args: input.args, result },
      ctx as KindCtx<unknown>,
    ) ?? "done";
  next = advance(game, ctx.state, log, w.fiber, frame, verdict);
  return { ok: true, state: settle(game, next, log), events: log };
}
