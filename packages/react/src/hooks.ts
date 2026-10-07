import type {
  EffectRef,
  Game,
  View,
  ViewEvent,
} from "@drock07/board-game-toolkit-engine";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  GameHost,
  type EventType,
  type GameHostOptions,
  type GameSnapshot,
} from "./host.js";

export interface UseGameResult<V, H> extends GameSnapshot<V, H> {
  submit: GameHost<V, H>["submit"];
  restart: GameHost<V, H>["restart"];
  setViewer: GameHost<V, H>["setViewer"];
  host: GameHost<V, H>;
}

/**
 * Hosts a game in a component: the displayed view, who may act and the
 * viewer's legal inputs, event playback and bots. The game and seats are
 * read once; remount (e.g. with a `key`) to change them. `viewer` follows
 * the option.
 */
export function useGame<V, H>(
  game: Game<V, H>,
  opts: GameHostOptions<V, H>,
): UseGameResult<V, H> {
  const [host] = useState(() => new GameHost(game, opts));
  useEffect(() => {
    host.start();
    return () => host.stop();
  }, [host]);
  const { viewer } = opts;
  useEffect(() => {
    if (viewer !== undefined) host.setViewer(viewer);
  }, [host, viewer]);
  // The same snapshot on the server, so server rendering shows the opening state
  const snapshot = useSyncExternalStore(
    host.subscribe,
    host.getSnapshot,
    host.getSnapshot,
  );
  return useMemo(
    () => ({
      ...snapshot,
      submit: host.submit,
      restart: host.restart,
      setViewer: host.setViewer,
      host,
    }),
    [host, snapshot],
  );
}

/** The viewer event with the given type. */
export type EventOfType<V, K extends EventType | "*"> = K extends EventType
  ? Extract<ViewEvent<V>, { type: K }>
  : ViewEvent<V>;

/** Keeps the latest handler without re-registering it on every render. */
function useLatest<F>(fn: F) {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return latest;
}

/**
 * Runs `handler` as each of the viewer's events of `type` plays back (`"*"`
 * for all), with the displayed view, which already includes it. Playback
 * waits for a returned promise before the next event, so animations can
 * finish. The handler may change between renders without re-registering.
 */
export function useGameEvent<V, H, K extends EventType | "*">(
  g: { host: GameHost<V, H> },
  type: K,
  handler: (event: EventOfType<V, K>, view: View<V>) => void | Promise<void>,
): void {
  const latest = useLatest(handler);
  const { host } = g;
  useEffect(
    () =>
      host.on(type, (event, view) =>
        latest.current(event as EventOfType<V, K>, view),
      ),
    [host, type, latest],
  );
}

/**
 * Runs `handler` with an effect's data each time the viewer sees it caused,
 * as it plays back: `useGameEffect(g, damage, (d) => shake(d.to))`. Typed
 * by the effect. Playback waits for a returned promise, as with
 * `useGameEvent`.
 */
export function useGameEffect<V, H, T>(
  g: { host: GameHost<V, H> },
  effect: EffectRef<T>,
  handler: (data: T, view: View<V>) => void | Promise<void>,
): void {
  const latest = useLatest(handler);
  const { host } = g;
  const { name } = effect;
  useEffect(
    () =>
      host.on("effect", (event, view) =>
        event.type === "effect" && event.name === name
          ? latest.current(event.data as T, view)
          : undefined,
      ),
    [host, name, latest],
  );
}
