// A sketch of an authoritative game room, for the "Running on a server" guide.
// Transport-free: `onSend` stands in for a WebSocket, HTTP response or similar.
import {
  apply,
  init,
  legalInputs,
  view,
  viewEvents,
  type AnyTypes,
  type Game,
  type GameEvent,
  type GameTypes,
  type Input,
  type PlayerId,
  type PlayerView,
  type ReadonlyGameState,
} from "@drock07/board-game-toolkit-engine";

// #region room
/** What the room sends a client: their view, their events since the last update, and their legal inputs. */
export interface Update<T extends GameTypes = AnyTypes> {
  view: PlayerView<T>;
  events: GameEvent<T>[];
  /** Listing moves needs the full state, so the server does it. */
  legal: Input[];
}

/** One game on the server. The full state never leaves this object. */
export class GameRoom<T extends GameTypes = AnyTypes> {
  private state: ReadonlyGameState<T>;
  /** Every accepted input: with the seed, a complete record of the game. */
  readonly inputs: Input[] = [];
  onSend: (player: PlayerId, update: Update<T>) => void = () => {};

  constructor(
    private readonly game: Game<T>,
    private readonly players: PlayerId[],
    readonly seed: string,
  ) {
    this.state = init(game, { players, seed }).state;
  }

  /** A player's current view, e.g. when they connect or reconnect. */
  viewFor(player: PlayerId): PlayerView<T> {
    return view(this.game, this.state, player);
  }

  /**
   * Handles an input from an authenticated connection. Returns an error
   * message for the client, or undefined once every player has been updated.
   */
  receive(from: PlayerId, input: Input): string | undefined {
    // The connection decides who the player is, never the message
    if (input.player !== from) return "You can only act for yourself";
    const before = this.state;
    const res = apply(this.game, before, input);
    if (!res.ok) return res.error.message;
    this.state = res.state;
    this.inputs.push(input);
    for (const player of this.players) {
      this.onSend(player, {
        view: view(this.game, res.state, player),
        events: viewEvents(this.game, before, res.events, player),
        legal: legalInputs(this.game, res.state, player),
      });
    }
    return undefined;
  }
}
// #endregion room
