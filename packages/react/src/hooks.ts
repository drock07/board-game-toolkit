import type {
  AnyTypes,
  Game,
  GameEvent,
  GameEventType,
  GameTypes,
  PlayerView,
} from "@drock07/board-game-toolkit-engine";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GameHost, type GameHostOptions, type GameSnapshot } from "./host.js";

export interface UseGameResult<
  T extends GameTypes = AnyTypes,
> extends GameSnapshot<T> {
  submit: GameHost<T>["submit"];
  restart: GameHost<T>["restart"];
  setViewer: GameHost<T>["setViewer"];
  host: GameHost<T>;
}

/**
 * Hosts a game in a component: the displayed view, the viewer's prompts and
 * legal inputs, event playback and bots. The game and seats are read once;
 * remount (e.g. with a `key`) to change them. `viewer` follows the option.
 */
export function useGame<T extends GameTypes>(
  game: Game<T>,
  opts: GameHostOptions<T>,
): UseGameResult<T> {
  const [host] = useState(() => new GameHost(game, opts));
  useEffect(() => {
    host.start();
    return () => host.stop();
  }, [host]);
  const { viewer } = opts;
  useEffect(() => {
    if (viewer !== undefined) host.setViewer(viewer);
  }, [host, viewer]);
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot);
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
export type EventOfType<
  T extends GameTypes,
  K extends GameEventType | "*",
> = K extends GameEventType ? Extract<GameEvent<T>, { type: K }> : GameEvent<T>;

/**
 * Runs `handler` as each of the viewer's events of `type` plays back (`"*"`
 * for all), with the displayed view, which already includes it. Playback
 * waits for a returned promise before the next event, so animations can
 * finish. The handler may change between renders without re-registering.
 */
export function useGameEvent<
  T extends GameTypes,
  K extends GameEventType | "*",
>(
  g: { host: GameHost<T> },
  type: K,
  handler: (
    event: EventOfType<T, K>,
    view: PlayerView<T>,
  ) => void | Promise<void>,
): void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  const { host } = g;
  useEffect(
    () =>
      host.on(type, (event, view) =>
        latest.current(event as EventOfType<T, K>, view),
      ),
    [host, type],
  );
}
