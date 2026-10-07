// Testing helpers: a seeded random bot, fuzzing, and checks that views hide
// what they should and that events replay to the new state and to each
// player's new view.
import { apply, check, init, legalInputs } from "../play.js";
import { seededRandom } from "../rng.js";
import type {
  GameDef,
  GameEvent,
  Input,
  PlayerId,
  State,
  ViewEvent,
} from "../types.js";
import { replay, view, viewEvents } from "../views.js";
import { canSee } from "../zones.js";

export function randomBot(seed: string) {
  const random = seededRandom(seed);
  return (legal: Input[]): Input => random.pick(legal);
}

/** Every entity a player may not see must be a placeholder in their view. */
export function checkViews<V>(game: GameDef<V>, state: State<V>): void {
  for (const player of state.players) {
    const v = view(game, state, player);
    for (const e of Object.values(state.entities)) {
      const shown = v.entities[e.ref]!;
      const visible = canSee(game, e, player);
      if (visible !== !("hidden" in shown))
        throw new Error(
          `${player}'s view ${visible ? "hides" : "shows"} ${e.id}`,
        );
      if ("hidden" in shown && ("props" in shown || "id" in shown))
        throw new Error(`${player}'s view leaks ${e.id}`);
    }
  }
}

/** Applies an input that must be legal; throws with the reason otherwise. */
export function applyOrThrow<V>(
  game: GameDef<V>,
  state: State<V>,
  input: Input,
): State<V> {
  const out = apply(game, state, input);
  if (!out.ok) throw new Error(out.reason);
  return out.state;
}

/** JSON with object keys sorted, so key order never makes two values differ. */
const json = (v: unknown): string =>
  JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : x,
  );

/** Replaying `events` onto `before` gives `after`, and so does each player's share of them onto their view. */
export function checkEvents<V>(
  game: GameDef<V>,
  before: State<V>,
  events: readonly GameEvent<V>[],
  after: State<V>,
): void {
  const pick = (s: State<V>) =>
    json({
      vars: s.vars,
      zones: s.zones,
      entities: s.entities,
      status: s.status,
      result: s.result,
    });
  if (pick(replay(before, events)) !== pick(after))
    throw new Error("Replaying the events doesn't give the new state");
  for (const player of before.players) {
    const mine = viewEvents(game, events, player);
    if (
      json(replay(view(game, before, player), mine)) !==
      json(view(game, after, player))
    )
      throw new Error(
        `Replaying ${player}'s events doesn't give their new view`,
      );
    const carried = (ev: ViewEvent<V>) =>
      "entity" in ev ? [ev.entity] : "entities" in ev ? ev.entities : [];
    const leaked = mine.find(
      (ev) =>
        carried(ev).some((e) => "hidden" in e && ("props" in e || "id" in e)) ||
        (ev.type === "custom" && ev.to && !ev.to.includes(player)),
    );
    if (leaked)
      throw new Error(`${player}'s events leak a ${leaked.type} event`);
  }
}

export interface FuzzOptions {
  seeds: number;
  players: PlayerId[];
  maxInputs: number;
}

export interface FuzzFailure {
  seed: string;
  step: number;
  message: string;
}

export function fuzz<V>(
  game: GameDef<V>,
  opts: FuzzOptions,
): { runs: number; finished: number; failures: FuzzFailure[] } {
  const failures: FuzzFailure[] = [];
  let finished = 0;
  for (let i = 0; i < opts.seeds; i++) {
    const seed = `fuzz-${i}`;
    const bot = randomBot(seed);
    let s: State<V> = init(game, { players: opts.players, seed });
    let step = 0;
    try {
      checkViews(game, s);
      for (; step < opts.maxInputs && s.status === "running"; step++) {
        const legal = legalInputs(game, s);
        if (legal.length === 0) throw new Error("No legal input");
        for (const input of legal) {
          const ok = check(game, s, input);
          if (ok !== true)
            throw new Error(
              `enumerate offered an input validate rejects: ${ok}`,
            );
        }
        const out = apply(game, s, bot(legal));
        if (!out.ok) throw new Error(out.reason);
        checkEvents(game, s, out.events, out.state);
        s = out.state;
        if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s))
          throw new Error("State is not plain JSON");
        checkViews(game, s);
      }
      if (s.status === "finished") finished++;
    } catch (e) {
      failures.push({ seed, step, message: (e as Error).message });
    }
  }
  return { runs: opts.seeds, finished, failures };
}
