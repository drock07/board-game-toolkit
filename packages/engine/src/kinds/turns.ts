// Players taking turns in seat order.
import { RulesError } from "../errors.js";
import type { Kind, Node, PlayerId } from "../types.js";

type Of<K extends string> = Extract<Node, { kind: K }>;

interface TurnsData {
  /** The first player's seat, from `from` when the node started. */
  start: number;
  /** Seats moved on from `start` to reach the current turn's player. */
  step: number;
  /** Turns started, skipped seats not counted. */
  taken: number;
}

const seatAt = (n: Of<"turns">, players: number, d: TurnsData) => {
  const step = d.step % players;
  const offset = n.order === "clockwise" ? step : (players - step) % players;
  return (d.start + offset) % players;
};

/**
 * Players take turns at the body, in seat order from `from` (or the first
 * seat), skipping anyone `among` leaves out. Ends when `until` holds
 * (checked before each turn), after `rounds` passes around the table, or
 * when nobody is left to take a turn.
 */
/** What `turns` shows players: whose turn it is, and how far along it is (both from 1). */
export interface TurnsShown {
  player: PlayerId;
  /** Turns started so far, this one included. */
  turn: number;
  /** Passes around the table started so far, this one included. */
  round: number;
}

export const turns: Kind<Of<"turns">, TurnsShown> = {
  children: (n) => [n.body],
  run(n, f, ctx) {
    const players = ctx.state.players;
    if (f.i === 0) {
      const first = n.from === undefined ? players[0] : ctx.query(n.from);
      const start = players.indexOf(first as PlayerId);
      if (start < 0)
        throw new RulesError(
          `"${n.id}" starts with unknown player "${String(first)}"`,
        );
      f.data = { start, step: -1, taken: 0 } satisfies TurnsData;
    }
    if (n.until !== undefined && ctx.holds(n.until)) return "done";
    const d = { ...(f.data as TurnsData) };
    const among =
      n.among === undefined ? undefined : (ctx.query(n.among) as PlayerId[]);
    for (let tries = 0; tries < players.length; tries++) {
      d.step++;
      if (n.rounds !== undefined && d.step >= n.rounds * players.length)
        return "done";
      if (!among || among.includes(players[seatAt(n, players.length, d)]!)) {
        f.data = { ...d, taken: d.taken + 1 };
        return { pass: n.body };
      }
    }
    return "done";
  },
  // No one's turn until the first one starts: the frame is pushed before it runs
  actor: (n, f, { state }) => {
    const d = f.data as TurnsData | undefined;
    if (!d || d.step < 0) return undefined;
    return state.players[seatAt(n, state.players.length, d)];
  },
  show(n, f, { state }) {
    const d = f.data as TurnsData | undefined;
    if (!d || d.step < 0) return undefined;
    return {
      player: state.players[seatAt(n, state.players.length, d)]!,
      turn: d.taken,
      round: Math.floor(d.step / state.players.length) + 1,
    };
  },
};
