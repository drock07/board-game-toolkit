import {
  apply,
  init,
  legalInputs,
  reduceEvents,
  seededRandom,
  view,
  viewEvents,
  type AnyTypes,
  type ApplyError,
  type ApplyResult,
  type Bot,
  type Game,
  type GameEvent,
  type GameEventType,
  type GameTypes,
  type Input,
  type Json,
  type PlayerId,
  type PlayerView,
  type Prompt,
  type ReadonlyGameState,
  type Viewer,
} from "@drock07/board-game-toolkit-engine";

/** Who answers a player's prompts: the person at the screen, or a bot. */
export type Controller<T extends GameTypes = AnyTypes> = "human" | Bot<T>;

export interface PlayerSeat<T extends GameTypes = AnyTypes> {
  id: PlayerId;
  /** Defaults to `"human"`. */
  controller?: Controller<T>;
}

export interface GameHostOptions<T extends GameTypes = AnyTypes> {
  /** Seats in order. A bare id is a human seat. */
  players: readonly (PlayerId | PlayerSeat<T>)[];
  /** Defaults to a random seed. */
  seed?: string;
  /** Whose view to show. Defaults to the first human seat, else a spectator. */
  viewer?: Viewer;
  /** Passed to the game's setup. */
  options?: Json;
  /** Milliseconds a bot waits before answering, for pacing. Defaults to 500. */
  botDelay?: number;
  /** How many of the viewer's events `log` keeps. Defaults to 200. */
  logLimit?: number;
}

/** Called with each of the viewer's events as it plays back. */
export type EventHandler<T extends GameTypes = AnyTypes> = (
  event: GameEvent<T>,
  /** The displayed view, which already includes the event. */
  view: PlayerView<T>,
) => void | Promise<void>;

export interface GameSnapshot<T extends GameTypes = AnyTypes> {
  /** The displayed view. Lags the committed state while events play back. */
  view: PlayerView<T>;
  /**
   * The committed state, with nothing hidden. For devtools and inspectors;
   * render the game from `view`.
   */
  state: ReadonlyGameState<T>;
  viewer: Viewer;
  seed: string;
  /**
   * The viewer's open prompts, if the viewer is a human seat. Empty while
   * events play back.
   */
  prompts: Prompt[];
  /** The viewer's legal inputs. Empty while events play back. */
  legal: Input[];
  /** True while events are playing back. */
  playing: boolean;
  /** The viewer's events so far, oldest first, up to `logLimit`. */
  log: GameEvent<T>[];
  /** Seats, with whether a bot plays each. */
  seats: { id: PlayerId; bot: boolean }[];
}

const randomSeed = () => Math.random().toString(36).slice(2, 10);

/**
 * Runs a game for one screen: commits inputs, plays the viewer's events back
 * one at a time (awaiting any handlers), and lets bots answer their prompts.
 * Framework-free; `useGame` wraps it for React.
 */
export class GameHost<T extends GameTypes = AnyTypes> {
  readonly game: Game<T>;
  private readonly opts: GameHostOptions<T>;
  private readonly bots = new Map<PlayerId, Bot<T>>();
  private readonly players: PlayerId[];

  private seed!: string;
  private viewer: Viewer;
  private committed!: ApplyResult<T>;
  /** The state on screen: the committed state, or an earlier one during playback. */
  private displayed!: ReadonlyGameState<T>;
  private queue: GameEvent<T>[] = [];
  private log: GameEvent<T>[] = [];
  private botRandom!: ReturnType<typeof seededRandom>;

  private readonly handlers = new Map<
    GameEventType | "*",
    Set<EventHandler<T>>
  >();
  private readonly listeners = new Set<() => void>();
  private snapshot!: GameSnapshot<T>;

  /** Bumped by restart and stop, so stale playback and bot work stops. */
  private generation = 0;
  private running = false;
  private pumping = false;
  private botTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(game: Game<T>, opts: GameHostOptions<T>) {
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

  getSnapshot = (): GameSnapshot<T> => this.snapshot;

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

  /** Applies an input to the committed state. Returns the error, if any. */
  submit = (input: Input): ApplyError["error"] | undefined => {
    const res = apply(this.game, this.committed.state, input);
    if (!res.ok) return res.error;
    this.commit(res);
    return undefined;
  };

  /** Starts a new game: a new seed unless one is given. */
  restart = (seed?: string): void => {
    const wasRunning = this.running;
    this.stop();
    this.reset(seed ?? randomSeed());
    if (wasRunning) this.start();
  };

  setViewer = (viewer: Viewer): void => {
    if (viewer === this.viewer) return;
    this.viewer = viewer;
    // Past events were seen by the old viewer
    this.log = [];
    this.emit();
  };

  /** Registers a playback handler. Playback awaits what it returns. */
  on(type: GameEventType | "*", handler: EventHandler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => set.delete(handler);
  }

  // -------------------------------------------------------------------------

  private reset(seed: string) {
    this.seed = seed;
    this.committed = init(this.game, {
      players: this.players,
      seed,
      ...(this.opts.options !== undefined && { options: this.opts.options }),
    });
    this.displayed = this.committed.state;
    this.queue = [];
    this.log = [];
    this.botRandom = seededRandom(`bots:${seed}`);
    this.emit();
  }

  private commit(res: ApplyResult<T>) {
    this.committed = res;
    this.queue.push(...res.events);
    this.emit();
    if (this.running) void this.pump();
  }

  /** Plays queued events onto the displayed state, awaiting their handlers. */
  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    const gen = this.generation;
    while (this.queue.length) {
      const event = this.queue.shift()!;
      const before = this.displayed;
      this.displayed = reduceEvents(before, [event]);
      const [seen] = viewEvents(this.game, before, [event], this.viewer);
      if (!seen) continue;
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
    // Locals and prompts aren't rebuilt by reduceEvents; take them from the commit
    this.displayed = this.committed.state;
    this.pumping = false;
    this.emit();
    this.scheduleBots();
  }

  private pushLog(event: GameEvent<T>) {
    this.log.push(event);
    const limit = this.opts.logLimit ?? 200;
    if (this.log.length > limit) this.log.splice(0, this.log.length - limit);
  }

  /** The first open prompt a bot can answer, and the bot. */
  private nextBotTurn() {
    const { state, prompts } = this.committed;
    if (state.status === "finished") return undefined;
    for (const prompt of prompts) {
      // People pace the game: a pause a human can answer is theirs to answer
      if (
        prompt.kind === "pause" &&
        prompt.actors.some((p) => !this.bots.has(p))
      )
        continue;
      for (const player of prompt.actors) {
        const bot = this.bots.get(player);
        if (!bot) continue;
        const legal = legalInputs(this.game, state, player).filter(
          (i) => i.prompt === prompt.id,
        );
        if (legal.length) return { prompt, player, bot, legal };
      }
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
        const { prompt, player, bot, legal } = turn;
        let input: Input;
        try {
          input = await bot(view(this.game, at.state, player), prompt, {
            player,
            legal,
            random: this.botRandom,
          });
        } catch (err) {
          console.error(`Bot for ${player} failed`, err);
          return;
        }
        // A restart, or another input, made this answer stale
        if (gen !== this.generation || at !== this.committed) return;
        const error = this.submit(input);
        if (error)
          console.error(
            `Bot for ${player} gave a rejected input: ${error.code}: ${error.message}`,
          );
      })();
    }, this.opts.botDelay ?? 500);
  }

  private emit() {
    const playing = this.queue.length > 0 || this.pumping;
    const v = view(this.game, this.displayed, this.viewer);
    // Only a human seat answers from this screen; a bot's seat is watched
    const answers =
      this.players.includes(this.viewer) && !this.bots.has(this.viewer);
    const prompts =
      playing || !answers
        ? []
        : this.committed.prompts.filter((p) => p.actors.includes(this.viewer));
    this.snapshot = {
      view: playing ? { ...v, prompts: [] } : v,
      state: this.committed.state,
      viewer: this.viewer,
      seed: this.seed,
      prompts,
      legal:
        playing || !answers
          ? []
          : legalInputs(this.game, this.committed.state, this.viewer),
      playing,
      log: [...this.log],
      seats: this.players.map((id) => ({ id, bot: this.bots.has(id) })),
    };
    for (const l of this.listeners) l();
  }
}
