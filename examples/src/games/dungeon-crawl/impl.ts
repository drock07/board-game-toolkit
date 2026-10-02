import {
  D20,
  D6,
  type DeepReadonly,
  type GameImpl,
  type Random,
  type Tx,
  type TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

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

export interface Vars {
  grid: Room[][];
  player: Player;
  log: string[];
  result: "victory" | "defeat" | null;
}

export interface CombatLocals {
  monster: string;
  playerRoll: number | null;
  playerDamage: number | null;
  monsterRoll: number | null;
  monsterDamage: number | null;
}

export interface TrapLocals {
  reward: Item;
  dismantled: boolean;
  lastRoll: number | null;
  damage: number;
}

// Locals are typed by node id; subflow nodes are prefixed by their use node
export type Types = TypesFor<
  typeof spec,
  {
    vars: Vars;
    locals: { "combat.fight": CombatLocals; "trap.trapRoom": TrapLocals };
  }
>;

export type MoveArgs = { row: number; col: number };
export type ItemArgs = { index: number };

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
  const roll = random.roll(D6) as number;
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

function generate(tx: Tx<Types>): Room[][] {
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
  tx.random.shuffle(cells).forEach(([r, c], i) => {
    const type = kinds[i]!;
    const room: Room = { type, revealed: false, visited: false };
    if (type === "monster") room.monster = monsterFor(r + c);
    if (type === "treasure") room.item = treasure(tx.random, false);
    if (type === "trap") room.item = treasure(tx.random, true);
    grid[r]![c] = room;
  });
  return grid;
}

export const impl = {
  setup(tx) {
    tx.vars = { grid: [], player: freshPlayer(), log: [], result: null };
  },
  conditions: {
    playerDead: (s) => s.vars.player.hp <= 0,
    bossDefeated: (s) => s.vars.grid[SIZE - 1]?.[SIZE - 1]?.monster?.hp === 0,
    monsterDead: (s) => roomAt(s).monster?.hp === 0,
    monsterHere: (s) => (roomAt(s).monster?.hp ?? 0) > 0,
    treasureHere: (s) =>
      roomAt(s).type === "treasure" && roomAt(s).item !== undefined,
    trapHere: (s) => roomAt(s).type === "trap" && roomAt(s).item !== undefined,
    trapDismantled: (s) => s.local("trap.trapRoom").dismantled,
  },
  locals: {
    combatFromRoom: (s): CombatLocals => ({
      monster: roomAt(s).monster!.name,
      playerRoll: null,
      playerDamage: null,
      monsterRoll: null,
      monsterDamage: null,
    }),
    trapFromRoom: (s): TrapLocals => ({
      reward: roomAt(s).item!,
      dismantled: false,
      lastRoll: null,
      damage: 0,
    }),
  },
  steps: {
    generateDungeon(tx) {
      tx.vars.grid = generate(tx);
      tx.vars.player = freshPlayer();
      tx.vars.result = null;
      tx.vars.log = ["You enter the dungeon..."];
      reveal(tx, 0, 0);
    },
    collectTreasure(tx) {
      const room = currentRoom(tx);
      log(tx, `Treasure: ${gain(tx, room.item!)}`);
      delete room.item;
    },
    monsterAttack(tx) {
      const m = currentRoom(tx).monster!;
      const p = tx.vars.player;
      const roll = tx.random.roll(D20) as number;
      const damage =
        roll >= 10 + p.defense ? (tx.random.roll(D6) as number) + m.attack : 0;
      p.hp = Math.max(0, p.hp - damage);
      Object.assign(tx.local("combat.fight"), {
        monsterRoll: roll,
        monsterDamage: damage,
      });
      log(
        tx,
        damage
          ? `${m.name} rolled ${roll}: hit for ${damage}. (You: ${p.hp}/${p.maxHp})`
          : `${m.name} rolled ${roll}: miss.`,
      );
    },
    markMonsterDefeated(tx) {
      log(tx, `${currentRoom(tx).monster!.name} defeated!`);
    },
    logFlee(tx) {
      log(tx, "You escaped!");
    },
    recordVictory(tx) {
      tx.vars.result = "victory";
      log(tx, "Victory! You conquered the dungeon!");
    },
    recordDefeat(tx) {
      tx.vars.result = "defeat";
      log(tx, "You have fallen in the dungeon...");
    },
  },
  actions: {
    move: {
      enumerate: (s): MoveArgs[] =>
        NEIGHBORS.map(([dr, dc]) => ({
          row: s.vars.player.row + dr,
          col: s.vars.player.col + dc,
        })).filter((a) => inBounds(a.row, a.col)),
      validate(s, { row, col }: MoveArgs) {
        const { row: r, col: c } = s.vars.player;
        return inBounds(row, col) && Math.abs(row - r) + Math.abs(col - c) === 1
          ? true
          : "You can only move to a neighboring room";
      },
      execute(tx, { row, col }: MoveArgs) {
        Object.assign(tx.vars.player, { row, col });
        reveal(tx, row, col);
      },
    },
    useItem: {
      enumerate: (s): ItemArgs[] =>
        s.vars.player.inventory.flatMap((item, index) =>
          item.type === "healthPotion" ? [{ index }] : [],
        ),
      validate: (s, { index }: ItemArgs) =>
        s.vars.player.inventory[index]?.type === "healthPotion"
          ? true
          : "That isn't a potion",
      execute(tx, { index }: ItemArgs) {
        const p = tx.vars.player;
        const [item] = p.inventory.splice(index, 1);
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + item!.value);
        log(
          tx,
          `Used ${item!.name}: healed ${p.hp - before}. (${p.hp}/${p.maxHp})`,
        );
      },
    },
    attack: {
      execute(tx) {
        const m = currentRoom(tx).monster!;
        const roll = tx.random.roll(D20) as number;
        const damage =
          roll >= m.defense
            ? (tx.random.roll(D6) as number) + tx.vars.player.attack
            : 0;
        m.hp = Math.max(0, m.hp - damage);
        Object.assign(tx.local("combat.fight"), {
          playerRoll: roll,
          playerDamage: damage,
        });
        log(
          tx,
          damage
            ? `You rolled ${roll}: hit for ${damage}. (${m.name}: ${m.hp}/${m.maxHp})`
            : `You rolled ${roll}: miss.`,
        );
      },
    },
    flee: {
      execute(tx) {
        const roll = tx.random.roll(D20) as number;
        tx.local("combat.fight").playerRoll = roll;
        if (roll >= ESCAPE_ROLL) tx.exit("fled");
        else log(tx, `You rolled ${roll}: couldn't escape!`);
      },
    },
    dismantle: {
      execute(tx) {
        const trap = tx.local("trap.trapRoom");
        const roll = tx.random.roll(D20) as number;
        trap.lastRoll = roll;
        if (roll >= ESCAPE_ROLL) {
          trap.dismantled = true;
          delete currentRoom(tx).item;
          log(tx, `You rolled ${roll}: dismantled! ${gain(tx, trap.reward)}`);
        } else {
          const damage = (tx.random.roll(D6) as number) + 2;
          trap.damage += damage;
          tx.vars.player.hp = Math.max(0, tx.vars.player.hp - damage);
          log(tx, `You rolled ${roll}: failed, and took ${damage} damage.`);
        }
      },
    },
    skip: { execute: () => {} },
  },
} satisfies GameImpl<Types>;

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
