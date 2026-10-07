// The server guide's room: the engine running on a server, sending each
// client only its own view and events. No network here: `send` stands in
// for whatever transport you use, and the test plays the clients.
import {
  apply,
  init,
  legalInputs,
  replayInputs,
  view,
  viewEvents,
  type Game,
  type InputOf,
  type PlayerId,
  type State,
  type View,
  type ViewEvent,
} from "@drock07/board-game-toolkit-engine";

// #region messages
/** What the server sends a client. */
export type ServerMessage<V, I> =
  /** On joining or reconnecting: the whole view, and what they may do. */
  | { type: "welcome"; view: View<V>; legal: I[] }
  /** After each input: their share of its events, and what they may do now. */
  | { type: "update"; events: ViewEvent<V>[]; legal: I[] }
  /** Their input was refused. */
  | { type: "rejected"; reason: string };
// #endregion messages

/** Picks an input from a seat's legal ones, on the server. */
export type ServerBot<I> = (legal: readonly I[]) => I;

// #region room
export class Room<V, H> {
  private state: State<V>;
  /** The game's log: replaying it from the seed rebuilds the state. */
  readonly inputs: InputOf<H>[] = [];

  constructor(
    private readonly game: Game<V, H>,
    readonly players: PlayerId[],
    readonly seed: string,
    private readonly send: (
      to: PlayerId,
      message: ServerMessage<V, InputOf<H>>,
    ) => void,
    private readonly bots: Record<PlayerId, ServerBot<InputOf<H>>> = {},
  ) {
    this.state = init(game, { players, seed });
  }

  /** A client connected (or reconnected) as `player`. */
  join(player: PlayerId): void {
    this.send(player, {
      type: "welcome",
      view: view(this.game, this.state, player),
      legal: legalInputs(this.game, this.state, player),
    });
  }

  /** A client sent an input. `sender` comes from the connection, never the message. */
  receive(sender: PlayerId, input: InputOf<H>): void {
    if (input.player !== sender)
      return this.send(sender, { type: "rejected", reason: "Not your seat" });
    const reason = this.play(input);
    if (reason) this.send(sender, { type: "rejected", reason });
    this.runBots();
  }

  /** Applies an input and sends every player their share of what happened. */
  private play(input: InputOf<H>): string | undefined {
    const out = apply(this.game, this.state, input);
    if (!out.ok) return out.reason;
    this.state = out.state;
    this.inputs.push(input);
    for (const p of this.players) {
      this.send(p, {
        type: "update",
        events: viewEvents(this.game, out.events, p),
        legal: legalInputs(this.game, this.state, p),
      });
    }
    return undefined;
  }

  /** Bot seats answer on the server, like any client, until a person must act. */
  private runBots(): void {
    for (let moved = true; moved && this.state.status === "running"; ) {
      moved = false;
      for (const [p, bot] of Object.entries(this.bots)) {
        const legal = legalInputs(this.game, this.state, p);
        if (legal.length && !this.play(bot(legal))) moved = true;
      }
    }
  }

  /** Rebuilds a room from its stored log, e.g. after the server restarts. */
  static restore<V, H>(
    game: Game<V, H>,
    log: { players: PlayerId[]; seed: string; inputs: InputOf<H>[] },
    send: (to: PlayerId, message: ServerMessage<V, InputOf<H>>) => void,
  ): Room<V, H> {
    const room = new Room(game, log.players, log.seed, send);
    room.state = replayInputs(game, log, log.inputs);
    room.inputs.push(...log.inputs);
    return room;
  }
}
// #endregion room
