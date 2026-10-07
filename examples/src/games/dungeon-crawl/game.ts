import {
  D20,
  D6,
  defaultNodes,
  define,
  type DeepReadonly,
  type Random,
} from "@drock07/board-game-toolkit-engine";

export const SIZE = 5;
const STARTING_HP = 20;
/** A d20 at or above this dismantles a trap or escapes a fight. */
const ESCAPE_ROLL = 12;

export interface Monster {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

export interface Item {
  type: "healthPotion" | "weapon" | "shield";
  name: string;
  value: number;
}

export interface Room {
  type: "start" | "monster" | "treasure" | "trap" | "boss";
  revealed: boolean;
  visited: boolean;
  /** Its hp drops in place during combat, so it stays beaten. */
  monster?: Monster;
  item?: Item;
}

export interface Player {
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  inventory: Item[];
  equipment: Item[];
}

/** The fight in this room, while it lasts: each side's last d20. */
export interface Combat {
  playerRoll: number | null;
  monsterRoll: number | null;
}

/** The trap in this room, while you face it. */
export interface Trap {
  /** What dismantling it earns; kept here because the room's item goes once it's won. */
  reward: Item;
  lastRoll: number | null;
  /** Damage taken from failed attempts. */
  damage: number;
}

// #region types
// The dungeon is a grid in vars, so there are no zones
export interface Vars {
  grid: Room[][];
  player: Player;
  log: string[];
  result: "victory" | "defeat" | null;
  combat: Combat | null;
  trap: Trap | null;
}
// #endregion types

const MONSTERS = {
  rat: { name: "Rat", hp: 4, attack: 0, defense: 8 },
  skeleton: { name: "Skeleton", hp: 8, attack: 1, defense: 10 },
  orc: { name: "Orc", hp: 14, attack: 2, defense: 12 },
  dragon: { name: "Dragon", hp: 24, attack: 4, defense: 14 },
} as const;

const monster = (m: (typeof MONSTERS)[keyof typeof MONSTERS]): Monster => ({
  ...m,
  maxHp: m.hp,
});

function monsterFor(distance: number): Monster {
  if (distance <= 2) return monster(MONSTERS.rat);
  if (distance <= 4) return monster(MONSTERS.skeleton);
  return monster(MONSTERS.orc);
}

function treasure(random: Random, greater: boolean): Item {
  const roll = random.roll(D6);
  if (roll <= 2)
    return {
      type: "healthPotion",
      name: greater ? "Greater Health Potion" : "Health Potion",
      value: greater ? 15 : 8,
    };
  if (roll <= 4)
    return {
      type: "weapon",
      name: greater ? "Fine Sword" : "Sharp Sword",
      value: greater ? 4 : 2,
    };
  return {
    type: "shield",
    name: greater ? "Tower Shield" : "Sturdy Shield",
    value: greater ? 4 : 2,
  };
}

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export const inBounds = (row: number, col: number) =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;

type Readable = { readonly vars: DeepReadonly<Vars> };
type Writable = { vars: Vars };

const roomAt = (s: Readable) =>
  s.vars.grid[s.vars.player.row]![s.vars.player.col]!;
const currentRoom = (tx: Writable) =>
  tx.vars.grid[tx.vars.player.row]![tx.vars.player.col]!;

function reveal(tx: Writable, row: number, col: number) {
  for (const [dr, dc] of NEIGHBORS) {
    if (inBounds(row + dr, col + dc))
      tx.vars.grid[row + dr]![col + dc]!.revealed = true;
  }
  Object.assign(tx.vars.grid[row]![col]!, { revealed: true, visited: true });
}

/** Adds an item: potions go to the inventory, gear raises a stat. */
function gain(tx: Writable, item: Item): string {
  const p = tx.vars.player;
  if (item.type === "healthPotion") {
    p.inventory.push(item);
    return `${item.name} added to inventory.`;
  }
  p.equipment.push(item);
  if (item.type === "weapon") p.attack += item.value;
  else p.defense += item.value;
  return `${item.name}: ${item.type === "weapon" ? "Attack" : "Defense"} +${item.value}.`;
}

const log = (tx: Writable, line: string) => void tx.vars.log.push(line);

function generate(random: Random): Room[][] {
  const grid: Room[][] = Array.from({ length: SIZE }, () =>
    Array.from(
      { length: SIZE },
      (): Room => ({ type: "treasure", revealed: false, visited: false }),
    ),
  );
  grid[0]![0] = { type: "start", revealed: true, visited: true };
  grid[SIZE - 1]![SIZE - 1] = {
    type: "boss",
    revealed: false,
    visited: false,
    monster: monster(MONSTERS.dragon),
  };
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r === 0 && c === 0) || (r === SIZE - 1 && c === SIZE - 1)) continue;
      cells.push([r, c]);
    }
  }
  const kinds = [
    ...Array<Room["type"]>(8).fill("monster"),
    ...Array<Room["type"]>(8).fill("treasure"),
    ...Array<Room["type"]>(7).fill("trap"),
  ];
  random.shuffle(cells).forEach(([r, c], i) => {
    const type = kinds[i]!;
    const room: Room = { type, revealed: false, visited: false };
    if (type === "monster") room.monster = monsterFor(r + c);
    if (type === "treasure") room.item = treasure(random, false);
    if (type === "trap") room.item = treasure(random, true);
    grid[r]![c] = room;
  });
  return grid;
}

function freshPlayer(): Player {
  return {
    row: 0,
    col: 0,
    hp: STARTING_HP,
    maxHp: STARTING_HP,
    attack: 0,
    defense: 0,
    inventory: [],
    equipment: [],
  };
}

const bossDefeated = (s: Readable) =>
  s.vars.grid[SIZE - 1]?.[SIZE - 1]?.monster?.hp === 0;
const monsterDead = (s: Readable) => roomAt(s).monster?.hp === 0;
const monsterHere = (s: Readable) => (roomAt(s).monster?.hp ?? 0) > 0;
const treasureHere = (s: Readable) =>
  roomAt(s).type === "treasure" && roomAt(s).item !== undefined;
const trapHere = (s: Readable) =>
  roomAt(s).type === "trap" && roomAt(s).item !== undefined;

/** Leaving a room, however it ends, puts away its fight or trap. */
const leaveRoom = (tx: Writable) => {
  tx.vars.combat = null;
  tx.vars.trap = null;
};

const { rules, action, branch, loop, outcomes, prompt, seq, step, turn } =
  define<Vars>().withNodes(defaultNodes);

// #region actions
export const move = action("move", {
  enumerate: (s) =>
    NEIGHBORS.map(([dr, dc]) => ({
      row: s.vars.player.row + dr,
      col: s.vars.player.col + dc,
    })).filter((a) => inBounds(a.row, a.col)),
  validate(s, { row, col }) {
    const { row: r, col: c } = s.vars.player;
    return inBounds(row, col) && Math.abs(row - r) + Math.abs(col - c) === 1
      ? true
      : "You can only move to a neighboring room";
  },
  execute(tx, { row, col }) {
    Object.assign(tx.vars.player, { row, col });
    reveal(tx, row, col);
    return "end";
  },
});

export const useItem = action("useItem", {
  enumerate: (s) =>
    s.vars.player.inventory.flatMap((item, index) =>
      item.type === "healthPotion" ? [{ index }] : [],
    ),
  validate: (s, { index }) =>
    s.vars.player.inventory[index]?.type === "healthPotion"
      ? true
      : "That isn't a potion",
  execute(tx, { index }) {
    const p = tx.vars.player;
    const [item] = p.inventory.splice(index, 1);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + item!.value);
    log(
      tx,
      `Used ${item!.name}: healed ${p.hp - before}. (${p.hp}/${p.maxHp})`,
    );
  },
});

export const attack = action("attack", {
  execute(tx) {
    const m = currentRoom(tx).monster!;
    const roll = tx.random.roll(D20);
    const damage =
      roll >= m.defense ? tx.random.roll(D6) + tx.vars.player.attack : 0;
    m.hp = Math.max(0, m.hp - damage);
    tx.vars.combat!.playerRoll = roll;
    log(
      tx,
      damage
        ? `You rolled ${roll}: hit for ${damage}. (${m.name}: ${m.hp}/${m.maxHp})`
        : `You rolled ${roll}: miss.`,
    );
  },
});

// #region flee
export const flee = action("flee", {
  execute(tx) {
    const roll = tx.random.roll(D20);
    tx.vars.combat!.playerRoll = roll;
    // Raises the fight's `fled` outcome
    if (roll >= ESCAPE_ROLL) return { exit: "fled" };
    log(tx, `You rolled ${roll}: couldn't escape!`);
  },
});
// #endregion flee

export const dismantle = action("dismantle", {
  execute(tx) {
    const trap = tx.vars.trap!;
    const roll = tx.random.roll(D20);
    trap.lastRoll = roll;
    if (roll >= ESCAPE_ROLL) {
      delete currentRoom(tx).item;
      log(tx, `You rolled ${roll}: dismantled! ${gain(tx, trap.reward)}`);
      return "end";
    }
    const damage = tx.random.roll(D6) + 2;
    trap.damage += damage;
    tx.vars.player.hp = Math.max(0, tx.vars.player.hp - damage);
    log(tx, `You rolled ${roll}: failed, and took ${damage} damage.`);
  },
});

export const skip = action("skip", { execute: () => "end" });

/** Moves on from a room once you've seen what happened. */
export const next = action("continue", { execute: () => {} });

export const again = action("again", { execute: () => {} });
// #endregion actions

// #region combat
/** A fight: attack or flee, then the monster strikes back, until it dies or you get away. */
const combat = seq(
  step((tx) => {
    tx.vars.combat = { playerRoll: null, monsterRoll: null };
  }),
  outcomes(
    {
      killed: {
        when: monsterDead,
        then: step((tx) =>
          log(tx, `${currentRoom(tx).monster!.name} defeated!`),
        ),
      },
      // Raised by `flee`
      fled: { then: step((tx) => log(tx, "You escaped!")) },
    },
    loop(
      {},
      seq(
        prompt({ label: "Attack or flee" }, attack, flee),
        step((tx) => {
          const m = currentRoom(tx).monster!;
          const p = tx.vars.player;
          const roll = tx.random.roll(D20);
          const damage =
            roll >= 10 + p.defense ? tx.random.roll(D6) + m.attack : 0;
          p.hp = Math.max(0, p.hp - damage);
          tx.vars.combat!.monsterRoll = roll;
          log(
            tx,
            damage
              ? `${m.name} rolled ${roll}: hit for ${damage}. (You: ${p.hp}/${p.maxHp})`
              : `${m.name} rolled ${roll}: miss.`,
          );
        }),
      ),
    ),
  ),
  step(leaveRoom),
);
// #endregion combat

// #region trap
/** A trap: try to dismantle it, as often as you like, or leave it. */
const trap = seq(
  step((tx) => {
    tx.vars.trap = { reward: currentRoom(tx).item!, lastRoll: null, damage: 0 };
  }),
  turn({ label: "Dismantle the trap or leave it" }, dismantle, skip),
  prompt({ label: "Continue" }, next),
  step(leaveRoom),
);
// #endregion trap

const treasureRoom = seq(
  step((tx) => {
    const room = currentRoom(tx);
    log(tx, `Treasure: ${gain(tx, room.item!)}`);
    delete room.item;
  }),
  prompt({ label: "Continue" }, next),
);

// #region rules
export const dungeonCrawl = rules({
  players: 1,
  setup(tx) {
    tx.vars = {
      grid: [],
      player: freshPlayer(),
      log: [],
      result: null,
      combat: null,
      trap: null,
    };
  },
  flow: loop(
    {},
    seq(
      // Generated before the run's guards are checked: a stale dungeon with
      // a dead boss would win again at once
      step((tx) => {
        tx.vars.grid = generate(tx.random);
        tx.vars.player = freshPlayer();
        tx.vars.result = null;
        tx.vars.log = ["You enter the dungeon..."];
        reveal(tx, 0, 0);
      }),
      // #region run
      // Outermost guards win: killing the boss also kills the room's
      // monster, and resolves as victory
      outcomes(
        {
          defeat: {
            when: (s) => s.vars.player.hp <= 0,
            then: step((tx) => {
              leaveRoom(tx);
              tx.vars.result = "defeat";
              log(tx, "You have fallen in the dungeon...");
            }),
          },
          victory: {
            when: bossDefeated,
            then: step((tx) => {
              leaveRoom(tx);
              tx.vars.result = "victory";
              log(tx, "Victory! You conquered the dungeon!");
            }),
          },
        },
        loop(
          {},
          seq(
            turn({ label: "Move" }, move, useItem),
            branch([
              { when: monsterHere, then: combat },
              { when: treasureHere, then: treasureRoom },
              { when: trapHere, then: trap },
            ]),
          ),
        ),
      ),
      // #endregion run
      prompt({ label: "Play again" }, again),
    ),
  ),
});
// #endregion rules
