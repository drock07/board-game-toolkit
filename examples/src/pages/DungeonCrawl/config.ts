import { Dice, type StateMachineConfig } from "@drock07/board-game-toolkit-core";

// --- Constants ---

export const GRID_WIDTH = 5;
export const GRID_HEIGHT = 5;
const STARTING_HP = 20;

// --- Types ---

export type RoomType = "start" | "monster" | "treasure" | "trap" | "boss";

export interface Monster {
  name: string;
  hp: number;
  attack: number;
  defense: number;
}

export type ItemType = "healthPotion" | "weapon" | "shield";

export interface Item {
  type: ItemType;
  name: string;
  value: number;
}

export interface Room {
  type: RoomType;
  revealed: boolean;
  visited: boolean;
  monster?: Monster;
  item?: Item;
}

export interface CombatState {
  monster: Monster;
  monsterCurrentHp: number;
  lastPlayerRoll: number | null;
  lastPlayerDamage: number | null;
  playerHit: boolean | null;
  lastMonsterRoll: number | null;
  lastMonsterDamage: number | null;
  monsterHit: boolean | null;
  fled: boolean;
}

export interface TrapResult {
  roll: number | null;
  succeeded: boolean | null;
  damage: number;
  dismantled: boolean;
  rewardItem: Item;
}

export interface DungeonCrawlState {
  grid: Room[][];
  playerRow: number;
  playerCol: number;
  playerHp: number;
  playerMaxHp: number;
  playerAttack: number;
  playerDefense: number;
  inventory: Item[];
  equipment: Item[];
  combat: CombatState | null;
  trapResult: TrapResult | null;
  foundItem: Item | null;
  message: string | null;
  gameResult: "victory" | "defeat" | null;
  log: string[];
}

export type DungeonCrawlCommand =
  | { type: "move"; row: number; col: number }
  | { type: "useItem"; index: number }
  | { type: "attack" }
  | { type: "flee" }
  | { type: "dismantle" };

// --- Monster Definitions ---

const MONSTERS = {
  rat: { name: "Rat", hp: 4, attack: 0, defense: 8 },
  skeleton: { name: "Skeleton", hp: 8, attack: 1, defense: 10 },
  orc: { name: "Orc", hp: 14, attack: 2, defense: 12 },
  dragon: { name: "Dragon", hp: 24, attack: 4, defense: 14 },
} as const;

// --- Helpers ---

function generateTreasureItem(): Item {
  const roll = Dice.roll(Dice.D6);
  if (roll <= 2)
    return { type: "healthPotion", name: "Health Potion", value: 8 };
  if (roll <= 4) return { type: "weapon", name: "Sharp Sword", value: 2 };
  return { type: "shield", name: "Sturdy Shield", value: 2 };
}

function generateTrapItem(): Item {
  const roll = Dice.roll(Dice.D6);
  if (roll <= 2)
    return { type: "healthPotion", name: "Greater Health Potion", value: 15 };
  if (roll <= 4) return { type: "weapon", name: "Fine Sword", value: 4 };
  return { type: "shield", name: "Tower Shield", value: 4 };
}

function monsterForDistance(distance: number): Monster {
  if (distance <= 2) return { ...MONSTERS.rat };
  if (distance <= 4) return { ...MONSTERS.skeleton };
  return { ...MONSTERS.orc };
}

function generateDungeon(): Room[][] {
  const grid: Room[][] = Array.from({ length: GRID_HEIGHT }, () =>
    Array.from(
      { length: GRID_WIDTH },
      (): Room => ({
        type: "treasure",
        revealed: false,
        visited: false,
      }),
    ),
  );

  // Fixed positions
  grid[0][0] = { type: "start", revealed: true, visited: true };
  grid[GRID_HEIGHT - 1][GRID_WIDTH - 1] = {
    type: "boss",
    revealed: false,
    visited: false,
    monster: { ...MONSTERS.dragon },
  };

  // Collect remaining positions and shuffle
  const positions: [number, number][] = [];
  for (let r = 0; r < GRID_HEIGHT; r++) {
    for (let c = 0; c < GRID_WIDTH; c++) {
      if (
        (r === 0 && c === 0) ||
        (r === GRID_HEIGHT - 1 && c === GRID_WIDTH - 1)
      )
        continue;
      positions.push([r, c]);
    }
  }
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // Distribute: 8 monsters, 8 treasures, 7 traps (no empty rooms)
  const distribution: RoomType[] = [
    ...Array<RoomType>(8).fill("monster"),
    ...Array<RoomType>(8).fill("treasure"),
    ...Array<RoomType>(7).fill("trap"),
  ];

  positions.forEach(([r, c], i) => {
    const roomType = distribution[i];
    const room: Room = { type: roomType, revealed: false, visited: false };
    if (roomType === "monster") {
      room.monster = monsterForDistance(r + c);
    }
    if (roomType === "treasure") {
      room.item = generateTreasureItem();
    }
    if (roomType === "trap") {
      room.item = generateTrapItem();
    }
    grid[r][c] = room;
  });

  return grid;
}

function revealAdjacentRooms(
  grid: Room[][],
  row: number,
  col: number,
): Room[][] {
  const newGrid = grid.map((r) => r.map((room) => ({ ...room })));
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < GRID_HEIGHT && nc >= 0 && nc < GRID_WIDTH) {
      newGrid[nr][nc] = { ...newGrid[nr][nc], revealed: true };
    }
  }
  newGrid[row][col] = { ...newGrid[row][col], revealed: true, visited: true };
  return newGrid;
}

function isAdjacent(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

// --- Initial State ---

export const initialState: DungeonCrawlState = {
  grid: [],
  playerRow: 0,
  playerCol: 0,
  playerHp: STARTING_HP,
  playerMaxHp: STARTING_HP,
  playerAttack: 0,
  playerDefense: 0,
  inventory: [],
  equipment: [],
  combat: null,
  trapResult: null,
  foundItem: null,
  message: null,
  gameResult: null,
  log: [],
};

// --- State Machine Config ---

export const dungeonCrawlConfig: StateMachineConfig<
  DungeonCrawlState,
  DungeonCrawlCommand
> = {
  id: "dungeonCrawl",
  initial: "setup",
  states: {
    // --- Setup: generate dungeon and reset player ---
    setup: {
      autoadvance: true,
      onEnter: (state) => {
        const grid = generateDungeon();
        const revealedGrid = revealAdjacentRooms(grid, 0, 0);
        return {
          ...state,
          grid: revealedGrid,
          playerRow: 0,
          playerCol: 0,
          playerHp: STARTING_HP,
          playerMaxHp: STARTING_HP,
          playerAttack: 0,
          playerDefense: 0,
          inventory: [],
          equipment: [],
          combat: null,
          trapResult: null,
          foundItem: null,
          message: null,
          gameResult: null,
          log: ["You enter the dungeon..."],
        };
      },
      getNext: () => "explore",
    },

    // --- Explore: move between rooms, use items ---
    explore: {
      onEnter: (state) => ({
        ...state,
        combat: null,
        trapResult: null,
        foundItem: null,
        message: null,
      }),
      actions: {
        move: {
          validate: (state, cmd) => {
            if (cmd.type !== "move") return false;
            const { row, col } = cmd;
            if (row < 0 || row >= GRID_HEIGHT || col < 0 || col >= GRID_WIDTH)
              return false;
            return isAdjacent(state.playerRow, state.playerCol, row, col);
          },
          execute: (state, cmd) => {
            if (cmd.type !== "move") return state;
            const { row, col } = cmd;
            const grid = revealAdjacentRooms(state.grid, row, col);
            grid[row][col] = { ...grid[row][col], visited: true };
            return { ...state, grid, playerRow: row, playerCol: col };
          },
        },
        useItem: {
          validate: (state, cmd) => {
            if (cmd.type !== "useItem") return false;
            const item = state.inventory[cmd.index];
            return item !== undefined && item.type === "healthPotion";
          },
          execute: (state, cmd) => {
            if (cmd.type !== "useItem") return state;
            const item = state.inventory[cmd.index];
            const newInventory = state.inventory.filter(
              (_, i) => i !== cmd.index,
            );
            const newHp = Math.min(
              state.playerHp + item.value,
              state.playerMaxHp,
            );
            const healed = newHp - state.playerHp;
            return {
              ...state,
              inventory: newInventory,
              playerHp: newHp,
              message: `Used ${item.name}! Healed for ${healed} HP.`,
              log: [...state.log, `Used ${item.name}. Healed ${healed} HP. (${newHp}/${state.playerMaxHp})`],
            };
          },
        },
      },
      getNext: (state) => {
        const room = state.grid[state.playerRow]?.[state.playerCol];
        if (!room) return "explore";
        if (
          (room.type === "monster" || room.type === "boss") &&
          room.monster &&
          room.monster.hp > 0
        ) {
          return "combat";
        }
        if (room.type === "treasure" && room.item) return "treasure";
        if (room.type === "trap" && room.item) return "trap";
        return "explore";
      },
    },

    // --- Combat: nested state machine ---
    combat: {
      id: "combat",
      initial: "playerAttack",
      onEnter: (state) => {
        const room = state.grid[state.playerRow][state.playerCol];
        const monster = room.monster!;
        return {
          ...state,
          combat: {
            monster: { ...monster },
            monsterCurrentHp: monster.hp,
            lastPlayerRoll: null,
            lastPlayerDamage: null,
            playerHit: null,
            lastMonsterRoll: null,
            lastMonsterDamage: null,
            monsterHit: null,
            fled: false,
          },
          message: `A ${monster.name} appears!`,
          log: [...state.log, `--- A ${monster.name} appears! (${monster.hp} HP) ---`],
        };
      },
      states: {
        playerAttack: {
          onEnter: (state) => ({
            ...state,
            combat: state.combat
              ? {
                  ...state.combat,
                  lastPlayerRoll: null,
                  lastPlayerDamage: null,
                  playerHit: null,
                }
              : null,
          }),
          actions: {
            attack: {
              execute: (state) => {
                const combat = state.combat!;
                const hitRoll = Dice.roll(Dice.D20);
                const hit = hitRoll >= combat.monster.defense;
                const damage = hit ? Dice.roll(Dice.D6) + state.playerAttack : 0;
                const newMonsterHp = Math.max(
                  0,
                  combat.monsterCurrentHp - damage,
                );
                const logEntry = hit
                  ? `You rolled ${hitRoll} — Hit for ${damage} damage! (${combat.monster.name}: ${newMonsterHp}/${combat.monster.hp})`
                  : `You rolled ${hitRoll} — Miss!`;
                return {
                  ...state,
                  combat: {
                    ...combat,
                    monsterCurrentHp: newMonsterHp,
                    lastPlayerRoll: hitRoll,
                    lastPlayerDamage: damage,
                    playerHit: hit,
                  },
                  log: [...state.log, logEntry],
                };
              },
            },
            flee: {
              execute: (state) => {
                const fleeRoll = Dice.roll(Dice.D20);
                const success = fleeRoll >= 12;
                const logEntry = success
                  ? `You tried to flee — Rolled ${fleeRoll} — Escaped!`
                  : `You tried to flee — Rolled ${fleeRoll} — Blocked!`;
                return {
                  ...state,
                  combat: {
                    ...state.combat!,
                    lastPlayerRoll: fleeRoll,
                    playerHit: null,
                    lastPlayerDamage: null,
                    fled: success,
                  },
                  message: success
                    ? `Rolled ${fleeRoll} — Escaped!`
                    : `Rolled ${fleeRoll} — Couldn't escape!`,
                  log: [...state.log, logEntry],
                };
              },
            },
          },
          getNext: (state) => {
            const combat = state.combat!;
            if (combat.fled) return null;
            if (combat.monsterCurrentHp <= 0) return null;
            return "monsterAttack";
          },
        },
        monsterAttack: {
          autoadvance: true,
          onEnter: (state) => {
            const combat = state.combat!;
            const hitRoll = Dice.roll(Dice.D20);
            const playerDefenseThreshold = 10 + state.playerDefense;
            const hit = hitRoll >= playerDefenseThreshold;
            const damage = hit
              ? Dice.roll(Dice.D6) + combat.monster.attack
              : 0;
            const newHp = Math.max(0, state.playerHp - damage);
            const logEntry = hit
              ? `${combat.monster.name} rolled ${hitRoll} — Hit for ${damage} damage! (You: ${newHp}/${state.playerMaxHp})`
              : `${combat.monster.name} rolled ${hitRoll} — Miss!`;
            return {
              ...state,
              playerHp: newHp,
              combat: {
                ...combat,
                lastMonsterRoll: hitRoll,
                lastMonsterDamage: damage,
                monsterHit: hit,
              },
              log: [...state.log, logEntry],
            };
          },
          getNext: (state) => {
            if (state.playerHp <= 0) return null;
            return "playerAttack";
          },
        },
      },
      // Called when nested machine exits (returns null)
      getNext: (state) => {
        if (state.playerHp <= 0) return "gameOver";
        const room = state.grid[state.playerRow][state.playerCol];
        if (
          room.type === "boss" &&
          state.combat &&
          state.combat.monsterCurrentHp <= 0
        ) {
          return "victory";
        }
        return "explore";
      },
      onExit: (state) => {
        const combat = state.combat;
        if (combat && combat.monsterCurrentHp <= 0) {
          const newGrid = state.grid.map((r) => r.map((room) => ({ ...room })));
          const room = newGrid[state.playerRow][state.playerCol];
          if (room.monster) {
            room.monster = { ...room.monster, hp: 0 };
          }
          return {
            ...state,
            grid: newGrid,
            log: [...state.log, `${combat.monster.name} defeated!`],
          };
        }
        return state;
      },
    },

    // --- Treasure: pick up item ---
    treasure: {
      onEnter: (state) => {
        const room = state.grid[state.playerRow][state.playerCol];
        const item = room.item!;

        const newGrid = state.grid.map((r) => r.map((rm) => ({ ...rm })));
        newGrid[state.playerRow][state.playerCol] = {
          ...newGrid[state.playerRow][state.playerCol],
          item: undefined,
        };

        const newState: DungeonCrawlState = {
          ...state,
          grid: newGrid,
          foundItem: item,
        };

        let logEntry: string;
        switch (item.type) {
          case "healthPotion":
            newState.inventory = [...state.inventory, item];
            newState.message = `Found a ${item.name}! Added to inventory.`;
            logEntry = `Treasure: ${item.name} added to inventory.`;
            break;
          case "weapon":
            newState.playerAttack = state.playerAttack + item.value;
            newState.equipment = [...state.equipment, item];
            newState.message = `Found a ${item.name}! Attack +${item.value}.`;
            logEntry = `Treasure: ${item.name} — Attack +${item.value}.`;
            break;
          case "shield":
            newState.playerDefense = state.playerDefense + item.value;
            newState.equipment = [...state.equipment, item];
            newState.message = `Found a ${item.name}! Defense +${item.value}.`;
            logEntry = `Treasure: ${item.name} — Defense +${item.value}.`;
            break;
        }
        newState.log = [...state.log, logEntry!];

        return newState;
      },
      getNext: () => "explore",
    },

    // --- Trap: attempt to dismantle for a reward ---
    trap: {
      onEnter: (state) => {
        // Only initialize on first entry; preserve state on re-entry after failed attempt
        if (state.trapResult) return state;
        const room = state.grid[state.playerRow][state.playerCol];
        return {
          ...state,
          trapResult: {
            roll: null,
            succeeded: null,
            damage: 0,
            dismantled: false,
            rewardItem: room.item!,
          },
          message: `You found a trap! Dismantle it to claim the ${room.item!.name}.`,
          log: [...state.log, `--- Trap! Reward: ${room.item!.name} ---`],
        };
      },
      actions: {
        dismantle: {
          execute: (state) => {
            const roll = Dice.roll(Dice.D20);
            const succeeded = roll >= 12;
            const damage = succeeded ? 0 : Dice.roll(Dice.D6) + 2;
            const newHp = Math.max(0, state.playerHp - damage);
            const trapResult: TrapResult = {
              ...state.trapResult!,
              roll,
              succeeded,
              damage: state.trapResult!.damage + damage,
              dismantled: succeeded,
            };

            const newState: DungeonCrawlState = {
              ...state,
              playerHp: newHp,
              trapResult,
            };

            if (succeeded) {
              const item = state.trapResult!.rewardItem;
              const newGrid = state.grid.map((r) =>
                r.map((rm) => ({ ...rm })),
              );
              newGrid[state.playerRow][state.playerCol] = {
                ...newGrid[state.playerRow][state.playerCol],
                item: undefined,
              };
              newState.grid = newGrid;
              newState.foundItem = item;

              let logDetail: string;
              switch (item.type) {
                case "healthPotion":
                  newState.inventory = [...state.inventory, item];
                  newState.message = `Rolled ${roll} — Dismantled! Found ${item.name}.`;
                  logDetail = `${item.name} added to inventory.`;
                  break;
                case "weapon":
                  newState.playerAttack = state.playerAttack + item.value;
                  newState.equipment = [...state.equipment, item];
                  newState.message = `Rolled ${roll} — Dismantled! ${item.name} — Attack +${item.value}.`;
                  logDetail = `${item.name} — Attack +${item.value}.`;
                  break;
                case "shield":
                  newState.playerDefense = state.playerDefense + item.value;
                  newState.equipment = [...state.equipment, item];
                  newState.message = `Rolled ${roll} — Dismantled! ${item.name} — Defense +${item.value}.`;
                  logDetail = `${item.name} — Defense +${item.value}.`;
                  break;
              }
              newState.log = [...state.log, `Rolled ${roll} — Dismantled! ${logDetail!}`];
            } else {
              newState.message = `Rolled ${roll} — Failed! Took ${damage} damage.`;
              newState.log = [...state.log, `Rolled ${roll} — Failed! Took ${damage} damage. (You: ${newHp}/${state.playerMaxHp})`];
            }

            return newState;
          },
        },
      },
      getNext: (state) => {
        if (state.playerHp <= 0) return "gameOver";
        return "explore";
      },
    },

    // --- Victory ---
    victory: {
      onEnter: (state) => ({
        ...state,
        gameResult: "victory" as const,
        message: "You defeated the Dragon and conquered the dungeon!",
        log: [...state.log, "Victory! You conquered the dungeon!"],
      }),
      getNext: () => "setup",
    },

    // --- Game Over ---
    gameOver: {
      onEnter: (state) => ({
        ...state,
        gameResult: "defeat" as const,
        message: "You have fallen in the dungeon...",
        log: [...state.log, "You have fallen in the dungeon..."],
      }),
      getNext: () => "setup",
    },
  },
};
