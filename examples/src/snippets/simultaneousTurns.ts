// The simultaneous turns guide's game: everyone draws from one pile at the
// same time, as often as they like, then stops. A trap drawn must be
// disarmed before its drawer goes on. By default that pauses only the
// drawer's fiber; with `pause: "everyone"` the whole table waits.
import {
  defaultNodes,
  define,
  entity,
  zone,
  type PlayerId,
  type Tx,
} from "@drock07/board-game-toolkit-engine";

export interface Vars {
  disarmed: Record<PlayerId, number>;
}

export const chip = entity<{ trap: boolean }>("chip");
export const pile = zone("pile", { holds: chip, visibility: "hidden" });
// Drawn chips are face up in front of their drawer
export const row = zone("row", { holds: chip, perPlayer: true });

const { rules, action, ability, loop, seq, step, simultaneous, turn, prompt } =
  define<Vars>({ zones: [pile, row] }).withNodes(defaultNodes);

// #region game
const draw = action("draw", {
  validate: (s) => (s.count(pile) > 0 ? true : "The pile is empty"),
  // `actor` is the fiber's player: each player draws for themselves
  execute: (tx, actor) => void tx.moveTop(pile, row.of(actor)),
});
const stop = action("stop", { execute: () => "end" });

const disarm = action("disarm", {
  execute: (tx, actor) => void tx.vars.disarmed[actor]!++,
});

// A trap entering your row stops you until you disarm it
const trap = ability({
  of: chip,
  where: (c) => c.props.trap,
  in: row,
  on: "enters",
  then: () => prompt({ label: "Disarm the trap" }, disarm),
});

const round = loop(
  {},
  seq(
    step((tx) => {
      for (const p of tx.players)
        tx.move(
          tx.entities(row.of(p)).map((c) => c.id),
          pile,
        );
      tx.shuffle(pile);
    }),
    // Everyone's turn at once, each on their own fiber
    simultaneous(turn({ label: "Draw or stop" }, draw, stop)),
  ),
);
// #endregion game

const setup = (tx: Tx<Vars>) => {
  tx.vars = {
    disarmed: Object.fromEntries(tx.players.map((p) => [p, 0])),
  };
  for (let i = 0; i < 12; i++) tx.create(chip, { trap: i % 4 === 0 }, pile);
};

export const drawAtOnce = rules({
  players: [2, 4],
  setup,
  abilities: [trap],
  flow: round,
});

// #region held
// The same trap, but while it's being disarmed nobody else moves
const heldTrap = ability({
  of: chip,
  where: (c) => c.props.trap,
  in: row,
  on: "enters",
  pause: "everyone",
  then: () => prompt({ label: "Disarm the trap" }, disarm),
});
// #endregion held

export const drawAtOnceHeld = rules({
  players: [2, 4],
  setup,
  abilities: [heldTrap],
  flow: round,
});
