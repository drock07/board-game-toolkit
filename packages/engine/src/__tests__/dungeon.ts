// Dungeon Crawl. One player explores a 5×5 grid: monsters to fight or flee,
// treasure to take, traps to dismantle, a boss in the far corner. Dying
// anywhere ends the run in defeat; killing the boss ends it in victory.
import { defaultNodes, define, type Reader, type Tx } from "../index.js";
import { turnNode } from "./turn.js";

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
}

const { rules, action, seq, step, loop, branch, outcomes, turn } =
  define<Vars>().withNodes([...defaultNodes, turnNode]);

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
const monsterFor = (distance: number) =>
  distance <= 2
    ? monster(MONSTERS.rat)
    : distance <= 4
      ? monster(MONSTERS.skeleton)
      : monster(MONSTERS.orc);

function treasure(roll: number, greater: boolean): Item {
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

type S = Pick<Reader<Vars>, "vars">;
const roomAt = (s: S) => s.vars.grid[s.vars.player.row]![s.vars.player.col]!;
const here = (tx: Tx<Vars>) =>
  tx.vars.grid[tx.vars.player.row]![tx.vars.player.col]!;
const log = (tx: Tx<Vars>, line: string) => void tx.vars.log.push(line);
const d20 = (tx: Tx<Vars>) => tx.random.int(1, 20);
const d6 = (tx: Tx<Vars>) => tx.random.int(1, 6);

function reveal(tx: Tx<Vars>, row: number, col: number) {
  for (const [dr, dc] of NEIGHBORS)
    if (inBounds(row + dr, col + dc))
      tx.vars.grid[row + dr]![col + dc]!.revealed = true;
  Object.assign(tx.vars.grid[row]![col]!, { revealed: true, visited: true });
}

/** Adds an item: potions go to the inventory, gear raises a stat. */
function gain(tx: Tx<Vars>, item: Item): string {
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

function generate(tx: Tx<Vars>): Room[][] {
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
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!((r === 0 && c === 0) || (r === SIZE - 1 && c === SIZE - 1)))
        cells.push([r, c]);
  const kinds = [
    ...Array<Room["type"]>(8).fill("monster"),
    ...Array<Room["type"]>(8).fill("treasure"),
    ...Array<Room["type"]>(7).fill("trap"),
  ];
  // Fisher–Yates with the game's rng
  for (let i = cells.length - 1; i > 0; i--) {
    const j = tx.random.int(0, i);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  cells.forEach(([r, c], i) => {
    const type = kinds[i]!;
    const room: Room = { type, revealed: false, visited: false };
    if (type === "monster") room.monster = monsterFor(r + c);
    if (type === "treasure") room.item = treasure(d6(tx), false);
    if (type === "trap") room.item = treasure(d6(tx), true);
    grid[r]![c] = room;
  });
  return grid;
}

const freshPlayer = (): Player => ({
  row: 0,
  col: 0,
  hp: STARTING_HP,
  maxHp: STARTING_HP,
  attack: 0,
  defense: 0,
  inventory: [],
  equipment: [],
});

const monsterHere = (s: S) => (roomAt(s).monster?.hp ?? 0) > 0;
const monsterDead = (s: S) => roomAt(s).monster?.hp === 0;
const treasureHere = (s: S) =>
  roomAt(s).type === "treasure" && roomAt(s).item !== undefined;
const trapHere = (s: S) =>
  roomAt(s).type === "trap" && roomAt(s).item !== undefined;
const bossDefeated = (s: S) =>
  s.vars.grid[SIZE - 1]![SIZE - 1]!.monster?.hp === 0;

/** A fight: attack or flee until the monster dies (a guard) or you get away (an outcome the flee action raises). */
const combat = outcomes(
  {
    killed: {
      when: monsterDead,
      then: step((tx) => log(tx, `${here(tx).monster!.name} defeated!`)),
    },
    fled: { then: step((tx) => log(tx, "You escaped!")) },
  },
  loop(
    {},
    seq(
      turn(
        {},
        action("attack", {
          execute: (tx) => {
            const m = here(tx).monster!;
            const roll = d20(tx);
            const damage =
              roll >= m.defense ? d6(tx) + tx.vars.player.attack : 0;
            m.hp = Math.max(0, m.hp - damage);
            log(
              tx,
              damage
                ? `You rolled ${roll}: hit for ${damage}. (${m.name}: ${m.hp}/${m.maxHp})`
                : `You rolled ${roll}: miss.`,
            );
            return "end";
          },
        }),
        action("flee", {
          execute: (tx) => {
            const roll = d20(tx);
            if (roll >= ESCAPE_ROLL) return { exit: "fled" };
            log(tx, `You rolled ${roll}: couldn't escape!`);
            return "end";
          },
        }),
      ),
      step((tx) => {
        const m = here(tx).monster!;
        const p = tx.vars.player;
        const roll = d20(tx);
        const damage = roll >= 10 + p.defense ? d6(tx) + m.attack : 0;
        p.hp = Math.max(0, p.hp - damage);
        log(
          tx,
          damage
            ? `${m.name} rolled ${roll}: hit for ${damage}. (You: ${p.hp}/${p.maxHp})`
            : `${m.name} rolled ${roll}: miss.`,
        );
      }),
    ),
  ),
);

/** A trap: try to dismantle it for its reward, or skip it. */
const trap = turn(
  {},
  action("dismantle", {
    execute: (tx) => {
      const room = here(tx);
      const roll = d20(tx);
      if (roll >= ESCAPE_ROLL) {
        log(tx, `You rolled ${roll}: dismantled! ${gain(tx, room.item!)}`);
        delete room.item;
        return "end";
      }
      const damage = d6(tx) + 2;
      tx.vars.player.hp = Math.max(0, tx.vars.player.hp - damage);
      log(tx, `You rolled ${roll}: failed, and took ${damage} damage.`);
    },
  }),
  action("skip", { execute: () => "end" }),
);

export const dungeonCrawl = rules({
  players: 1,
  setup: (tx) => {
    tx.vars = { grid: [], player: freshPlayer(), log: [] };
    tx.vars.grid = generate(tx);
    tx.vars.log = ["You enter the dungeon..."];
    reveal(tx, 0, 0);
  },
  flow: seq(
    outcomes(
      {
        defeat: {
          when: (s) => s.vars.player.hp <= 0,
          then: step((tx) => log(tx, "You have fallen in the dungeon...")),
        },
        victory: {
          when: bossDefeated,
          then: step((tx) => log(tx, "Victory! You conquered the dungeon!")),
        },
      },
      loop(
        {},
        seq(
          turn(
            {},
            action("move", {
              enumerate: (s) =>
                NEIGHBORS.map(([dr, dc]) => ({
                  row: s.vars.player.row + dr,
                  col: s.vars.player.col + dc,
                })).filter((a) => inBounds(a.row, a.col)),
              execute: (tx, { row, col }) => {
                Object.assign(tx.vars.player, { row, col });
                reveal(tx, row, col);
                return "end";
              },
            }),
            action("useItem", {
              enumerate: (s) =>
                s.vars.player.inventory.flatMap((item, index) =>
                  item.type === "healthPotion" ? [{ index }] : [],
                ),
              execute: (tx, { index }) => {
                const p = tx.vars.player;
                const [item] = p.inventory.splice(index, 1);
                const before = p.hp;
                p.hp = Math.min(p.maxHp, p.hp + item!.value);
                log(
                  tx,
                  `Used ${item!.name}: healed ${p.hp - before}. (${p.hp}/${p.maxHp})`,
                );
              },
            }),
          ),
          branch([
            { when: monsterHere, then: combat },
            {
              when: treasureHere,
              then: step((tx) => {
                const room = here(tx);
                log(tx, `Treasure: ${gain(tx, room.item!)}`);
                delete room.item;
              }),
            },
            { when: trapHere, then: trap },
          ]),
        ),
      ),
    ),
    step((tx) =>
      tx.end({
        result: bossDefeated(tx) ? "victory" : "defeat",
        log: tx.vars.log,
      }),
    ),
  ),
});
