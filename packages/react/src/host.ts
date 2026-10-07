import {
  actors,
  apply,
  init,
  legalInputs,
  replay,
  seededRandom,
  view,
  viewEvents,
  type Game,
  type GameEvent,
  type InputOf,
  type PlayerId,
  type Random,
  type State,
  type View,
  type ViewEvent,
} from "@drock07/board-game-toolkit-engine";

/** Whose view to show: a seat, or anyone else (`"spectator"`), who sees only what's public. */
export type Viewer = PlayerId;

/**
 * Picks a seat's input from its legal ones. The engine's `randomBot(seed)`
 * is one. May be async, e.g. to think or to call out.
 */
export type Bot<V, I> = (
  legal: readonly I[],
  ctx: { view: View<V>; player: PlayerId; random: Random },
) => I | Promise<I>;

/** Who answers a seat's prompts: the person at the screen, or a bot. */
export type Controller<V, I> = "human" | Bot<V, I>;

export interface PlayerSeat<V, I> {
  id: PlayerId;
  /** Defaults to `"human"`. */
  controller?: Controller<V, I>;
}

export interface GameHostOptions<V, H> {
  /** Seats in order. A bare id is a human seat. */
  players: readonly (PlayerId | PlayerSeat<V, InputOf<H>>)[];
  /** Defaults to a random seed. */
  seed?: string;
  /** Whose view to show. Defaults to the first human seat, else `"spectator"`. */
  viewer?: Viewer;
  /** Milliseconds a bot waits before answering, for pacing. Defaults to 500. */
  botDelay?: number;
  /** How many of the viewer's events `log` keeps. Defaults to 200. */
  logLimit?: number;
}

export type EventType = ViewEvent["type"];

/** Called with each of the viewer's events as it plays back. */
export type EventHandler<V> = (
  event: ViewEvent<V>,
  /** The displayed view, which already includes the event. */
  view: View<V>,
) => void | Promise<void>;

export interface GameSnapshot<V, H> {
  /**
   * The displayed view. Lags the committed state while events play back,
   * one event at a time (`shown` included); meanwhile its `waiting` is
   * empty, since nothing can be answered until playback ends.
   */
  view: View<V>;
  /**
   * The committed state, with nothing hidden. For devtools and inspectors;
   * render the game from `view`.
   */
  state: State<V>;
  viewer: Viewer;
  seed: string;
  /** Who may act now. Empty while events play back. */
  actors: PlayerId[];
  /** The viewer's legal inputs, if the viewer is a human seat. Empty while events play back. */
  legal: InputOf<H>[];
  /** True while events are playing back. */
  playing: boolean;
  /** The viewer's events so far, oldest first, up to `logLimit`. */
  log: ViewEvent<V>[];
  /** Seats, with whether a bot plays each. */
  seats: { id: PlayerId; bot: boolean }[];
}

const randomSeed = () => Math.random().toString(36).slice(2, 10);

/**
 * Runs a game for one screen: commits inputs, plays the viewer's events back
 * one at a time onto their view (awaiting any handlers), and lets bots
 * answer when their seats may act. Framework-free; `useGame` wraps it.
 */
export class GameHost<V, H> {
  readonly game: Game<V, H>;
  private readonly opts: GameHostOptions<V, H>;
  private readonly bots = new Map<PlayerId, Bot<V, InputOf<H>>>();
  private readonly players: PlayerId[];

  private seed!: string;
  private viewer: Viewer;
  private committed!: State<V>;
  /** The view on screen: the committed state's, or an earlier one during playback. */
  private displayed!: View<V>;
  private queue: GameEvent<V>[] = [];
  private log: ViewEvent<V>[] = [];
  private botRandom!: Random;

  private readonly handlers = new Map<EventType | "*", Set<EventHandler<V>>>();
  private readonly listeners = new Set<() => void>();
  private snapshot!: GameSnapshot<V, H>;

  /** Bumped by restart and stop, so stale playback and bot work stops. */
  private generation = 0;
  private running = false;
  private pumping = false;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(game: Game<V, H>, opts: GameHostOptions<V, H>) {
    this.game = game;
    this.opts = opts;
    this.players = opts.players.map((p) => (typeof p === "string" ? p : p.id));
    for (const p of opts.players) {
      if (typeof p !== "string" && p.controller && p.controller !== "human")
        this.bots.set(p.id, p.controller);
    }
    this.viewer =
      opts.viewer ?? this.players.find((p) => !this.bots.has(p)) ?? "spectator";
    this.reset(opts.seed ?? randomSeed());
  }

  // -------------------------------------------------------------------------
  // External store

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameSnapshot<V, H> => this.snapshot;

  /** Starts playback and bots. Safe to call again after `stop`. */
  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.queue.length) void this.pump();
    else this.scheduleBots();
  }

  /** Pauses playback and bots, e.g. on unmount. */
  stop(): void {
    this.running = false;
    this.generation++;
    this.pumping = false;
    clearTimeout(this.botTimer);
  }

  // -------------------------------------------------------------------------
  // Commands

  /** Applies an input to the committed state. Returns why it was rejected, if it was. */
  submit = (input: InputOf<H>): string | undefined => {
    const out = apply(this.game, this.committed, input);
    if (!out.ok) return out.reason;
    this.committed = out.state;
    this.queue.push(...out.events);
    this.emit();
    if (this.running) void this.pump();
    return undefined;
  };

  /** Starts a new game: a new seed unless one is given. */
  restart = (seed?: string): void => {
    const wasRunning = this.running;
    this.stop();
    this.reset(seed ?? randomSeed());
    if (wasRunning) this.start();
  };

  /** Shows another seat's view, or a spectator's. Skips any playback in progress. */
  setViewer = (viewer: Viewer): void => {
    if (viewer === this.viewer) return;
    this.viewer = viewer;
    // Past events were seen by the old viewer, and so was the displayed view
    this.log = [];
    this.queue = [];
    this.displayed = view(this.game, this.committed, viewer);
    this.emit();
  };

  /** Registers a playback handler. Playback awaits what it returns. */
  on(type: EventType | "*", handler: EventHandler<V>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => set.delete(handler);
  }

  // -------------------------------------------------------------------------

  private reset(seed: string) {
    this.seed = seed;
    this.committed = init(this.game, { players: this.players, seed });
    this.displayed = view(this.game, this.committed, this.viewer);
    this.queue = [];
    this.log = [];
    this.botRandom = seededRandom(`bots:${seed}`);
    this.emit();
  }

  /** Plays queued events onto the displayed view, awaiting their handlers. */
  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    const gen = this.generation;
    while (this.queue.length) {
      const event = this.queue.shift()!;
      const [seen] = viewEvents(this.game, [event], this.viewer);
      if (!seen) continue;
      this.displayed = replay(this.displayed, [seen]);
      this.pushLog(seen);
      const handlers = [
        ...(this.handlers.get(seen.type) ?? []),
        ...(this.handlers.get("*") ?? []),
      ];
      if (!handlers.length) continue;
      this.emit();
      const shown = this.snapshot.view;
      await Promise.all(
        handlers.map(async (h) => {
          try {
            await h(seen, shown);
          } catch (err) {
            console.error("useGameEvent handler failed", err);
          }
        }),
      );
      if (gen !== this.generation) return;
    }
    // Events don't carry the flow's `waiting` and `shown`; take the commit's view
    this.displayed = view(this.game, this.committed, this.viewer);
    this.pumping = false;
    this.emit();
    this.scheduleBots();
  }

  private pushLog(event: ViewEvent<V>) {
    this.log.push(event);
    const limit = this.opts.logLimit ?? 200;
    if (this.log.length > limit) this.log.splice(0, this.log.length - limit);
  }

  /** The first bot seat that may act now and has something legal to do. */
  private nextBotTurn() {
    const state = this.committed;
    if (state.status === "finished") return undefined;
    for (const player of actors(this.game, state)) {
      const bot = this.bots.get(player);
      if (!bot) continue;
      const legal = legalInputs(this.game, state, player);
      if (legal.length) return { player, bot, legal };
    }
    return undefined;
  }

  private scheduleBots() {
    clearTimeout(this.botTimer);
    if (!this.running || this.pumping || !this.nextBotTurn()) return;
    const gen = this.generation;
    const at = this.committed;
    this.botTimer = setTimeout(() => {
      void (async () => {
        const turn = this.nextBotTurn();
        if (!turn) return;
        const { player, bot, legal } = turn;
        let input: InputOf<H>;
        try {
          input = await bot(legal, {
            view: view(this.game, at, player),
            player,
            random: this.botRandom,
          });
        } catch (err) {
          console.error(`Bot for ${player} failed`, err);
          return;
        }
        // A restart, or another input, made this answer stale
        if (gen !== this.generation || at !== this.committed) return;
        const reason = this.submit(input);
        if (reason)
          console.error(`Bot for ${player} gave a rejected input: ${reason}`);
      })();
    }, this.opts.botDelay ?? 500);
  }

  private emit() {
    const playing = this.queue.length > 0 || this.pumping;
    // Only a human seat answers from this screen; a bot's seat is watched
    const answers =
      this.players.includes(this.viewer) && !this.bots.has(this.viewer);
    const quiet = playing || this.committed.status === "finished";
    this.snapshot = {
      view: playing ? { ...this.displayed, waiting: [] } : this.displayed,
      state: this.committed,
      viewer: this.viewer,
      seed: this.seed,
      actors: quiet ? [] : actors(this.game, this.committed),
      legal:
        quiet || !answers
          ? []
          : legalInputs(this.game, this.committed, this.viewer),
      playing,
      log: [...this.log],
      seats: this.players.map((id) => ({ id, bot: this.bots.has(id) })),
    };
    for (const l of this.listeners) l();
  }
}
