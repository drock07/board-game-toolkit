import {
  GridGameBoard,
  useStateMachineActions,
  useStateMachineCurrentState,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import PageLayout, {
  GlassButton,
  GlassContainer,
} from "../../components/PageLayout";
import {
  type CombatState,
  type DungeonCrawlCommand,
  type DungeonCrawlState,
  type Item,
  type Room,
  type TrapResult,
  GRID_HEIGHT,
  GRID_WIDTH,
  dungeonCrawlConfig,
  initialState,
} from "./config";

// --- Main Component ---

export function DungeonCrawl() {
  const state = useStateMachineState<DungeonCrawlState>();
  const currentStates = useStateMachineCurrentState<DungeonCrawlState>();
  const { dispatch, advance } = useStateMachineActions<
    DungeonCrawlState,
    DungeonCrawlCommand
  >();

  const isExploring = currentStates.includes("explore");
  const inCombat = currentStates.includes("combat");
  const isPlayerAttack = currentStates.includes("playerAttack");
  const isTreasure = currentStates.includes("treasure");
  const isTrap = currentStates.includes("trap");
  const isVictory = currentStates.includes("victory");
  const isGameOver = currentStates.includes("gameOver");
  const showOverlay =
    inCombat || isTreasure || isTrap || isVictory || isGameOver;

  return (
    <PageLayout
      title="Dungeon Crawl"
      bottomCenter={
        <ActionButtons
          state={state}
          isExploring={isExploring}
          isPlayerAttack={isPlayerAttack}
          isTreasure={isTreasure}
          isTrap={isTrap}
          isVictory={isVictory}
          isGameOver={isGameOver}
          dispatch={dispatch}
          advance={advance}
        />
      }
    >
      <div className="flex size-full flex-col overflow-hidden text-white">
        <PageLayout.SafeInset />
        <div className="flex min-h-0 flex-1 items-center justify-center gap-4 px-4">
          <div className="flex h-full w-64 flex-col gap-4">
            <div className="flex-1">
              <StatsPanel state={state} />
            </div>
            <div className="flex-1">
              <InventoryPanel
                state={state}
                isExploring={isExploring}
                dispatch={dispatch}
              />
            </div>
          </div>
          <div className="relative flex h-full flex-1 items-center justify-center">
            <div className="aspect-square h-full max-h-full max-w-full overflow-hidden rounded-lg border-4 border-stone-500">
              <GridGameBoard width={GRID_WIDTH} height={GRID_HEIGHT}>
                {(row, col) => (
                  <DungeonTile
                    row={row}
                    col={col}
                    state={state}
                    isExploring={isExploring}
                    dispatch={dispatch}
                    advance={advance}
                  />
                )}
              </GridGameBoard>
            </div>

            {showOverlay && (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/60">
                <div className="mx-4 max-w-sm rounded-xl border border-white/10 bg-stone-900/95 p-6 shadow-2xl backdrop-blur">
                  {inCombat && state.combat && (
                    <CombatPanel combat={state.combat} />
                  )}
                  {isTreasure && state.foundItem && (
                    <TreasurePanel
                      item={state.foundItem}
                      message={state.message}
                    />
                  )}
                  {isTrap && state.trapResult && (
                    <TrapPanel
                      result={state.trapResult}
                      message={state.message}
                    />
                  )}
                  {isVictory && (
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-yellow-400">
                        Victory!
                      </h2>
                      <p className="mt-2 text-stone-300">{state.message}</p>
                    </div>
                  )}
                  {isGameOver && (
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-red-400">
                        Defeat
                      </h2>
                      <p className="mt-2 text-stone-300">{state.message}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex h-full w-64 flex-col gap-4">
            <MessageLog log={state.log} />
          </div>
        </div>
        <PageLayout.SafeInset />
      </div>
    </PageLayout>
  );
}

// --- Dungeon Tile ---

function DungeonTile({
  row,
  col,
  state,
  isExploring,
  dispatch,
  advance,
}: {
  row: number;
  col: number;
  state: DungeonCrawlState;
  isExploring: boolean;
  dispatch: (cmd: DungeonCrawlCommand) => void;
  advance: () => void;
}) {
  const room = state.grid[row]?.[col];
  if (!room) return <div className="size-full bg-stone-950" />;

  const isPlayer = state.playerRow === row && state.playerCol === col;
  const canMove =
    isExploring &&
    isAdjacent(state.playerRow, state.playerCol, row, col) &&
    room.revealed;

  const handleClick = () => {
    if (!canMove) return;
    dispatch({ type: "move", row, col });
    advance();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canMove}
      className={clsx(
        "relative flex size-full items-center justify-center border border-stone-800 transition-colors",
        !room.revealed && "bg-stone-950",
        room.revealed && !room.visited && "bg-stone-800",
        room.revealed && room.visited && "bg-stone-700",
        canMove &&
          "cursor-pointer ring-2 ring-yellow-400/60 ring-inset hover:bg-stone-600",
        !canMove && "cursor-default",
      )}
      aria-label={tileAriaLabel(room, isPlayer, row, col)}
    >
      {room.revealed && <RoomContent room={room} isPlayer={isPlayer} />}
    </button>
  );
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function tileAriaLabel(
  room: Room,
  isPlayer: boolean,
  row: number,
  col: number,
): string {
  if (!room.revealed)
    return `Unrevealed room at row ${row + 1}, column ${col + 1}`;
  const base = `Row ${row + 1}, column ${col + 1}`;
  if (isPlayer) return `${base} — Your position`;
  if (room.type === "monster" && room.monster && room.monster.hp > 0)
    return `${base} — ${room.monster.name}`;
  if (room.type === "boss" && room.monster && room.monster.hp > 0)
    return `${base} — Boss: ${room.monster.name}`;
  if (room.type === "treasure" && room.item) return `${base} — Treasure`;
  if (room.type === "trap" && room.item) return `${base} — Trap`;
  if (room.type === "trap") return `${base} — Dismantled trap`;
  return `${base} — Cleared`;
}

// --- Room Content ---

function RoomContent({ room, isPlayer }: { room: Room; isPlayer: boolean }) {
  return (
    <>
      {/* Room type indicator (shown behind player) */}
      {!isPlayer &&
        room.type === "monster" &&
        room.monster &&
        room.monster.hp > 0 && (
          <span className="text-xl text-red-400" aria-hidden>
            &#x2694;
          </span>
        )}
      {!isPlayer &&
        room.type === "boss" &&
        room.monster &&
        room.monster.hp > 0 && (
          <span className="text-xl text-purple-400" aria-hidden>
            &#x2620;
          </span>
        )}
      {!isPlayer && room.type === "treasure" && room.item && (
        <span className="text-xl text-yellow-400" aria-hidden>
          &#x2666;
        </span>
      )}
      {!isPlayer && room.type === "treasure" && !room.item && (
        <span className="text-sm text-stone-500" aria-hidden>
          &#x2666;
        </span>
      )}
      {!isPlayer && room.type === "trap" && room.item && (
        <span className="text-xl text-orange-400" aria-hidden>
          &#x26A0;
        </span>
      )}
      {!isPlayer && room.type === "trap" && !room.item && (
        <span className="text-sm text-stone-500" aria-hidden>
          &#x26A0;
        </span>
      )}
      {/* Cleared rooms */}
      {!isPlayer &&
        room.type === "monster" &&
        room.monster &&
        room.monster.hp <= 0 && (
          <span className="text-sm text-stone-500" aria-hidden>
            &#x2694;
          </span>
        )}
      {/* Player token */}
      {isPlayer && (
        <div className="size-3/5 rounded-full border-2 border-blue-300 bg-blue-500 shadow-lg shadow-blue-500/30" />
      )}
    </>
  );
}

// --- Stats Panel ---

function StatsPanel({ state }: { state: DungeonCrawlState }) {
  const hpPercent = (state.playerHp / state.playerMaxHp) * 100;
  const hpColor =
    hpPercent > 60
      ? "bg-green-500"
      : hpPercent > 30
        ? "bg-yellow-500"
        : "bg-red-500";

  const dmgMin = 1 + state.playerAttack;
  const dmgMax = 6 + state.playerAttack;
  const defThreshold = 10 + state.playerDefense;

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30 backdrop-blur">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">
        Stats
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* HP */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-300">HP</span>
            <span className="text-stone-400 tabular-nums">
              {state.playerHp}/{state.playerMaxHp}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-700">
            <div
              className={clsx("h-full transition-all duration-300", hpColor)}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Attack */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-300">Attack</span>
            {state.playerAttack > 0 && (
              <span className="text-orange-400">+{state.playerAttack}</span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Damage: {dmgMin}–{dmgMax}
          </p>
        </div>

        {/* Defense */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-300">Defense</span>
            {state.playerDefense > 0 && (
              <span className="text-cyan-400">+{state.playerDefense}</span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Enemies need {defThreshold}+ to hit
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Action Buttons ---

function ActionButtons({
  state,
  isExploring,
  isPlayerAttack,
  isTreasure,
  isTrap,
  isVictory,
  isGameOver,
  dispatch,
  advance,
}: {
  state: DungeonCrawlState;
  isExploring: boolean;
  isPlayerAttack: boolean;
  isTreasure: boolean;
  isTrap: boolean;
  isVictory: boolean;
  isGameOver: boolean;
  dispatch: (cmd: DungeonCrawlCommand) => void;
  advance: () => void;
}) {
  if (isExploring) {
    return (
      <GlassContainer className="text-sm">
        {state.message || "Click an adjacent room to move"}
      </GlassContainer>
    );
  }

  if (isPlayerAttack) {
    return (
      <>
        <GlassButton
          onClick={() => {
            dispatch({ type: "attack" });
            advance();
          }}
        >
          Attack
        </GlassButton>
        <GlassButton
          onClick={() => {
            dispatch({ type: "flee" });
            advance();
          }}
        >
          Flee
        </GlassButton>
      </>
    );
  }

  if (isTreasure) {
    return <GlassButton onClick={() => advance()}>Continue</GlassButton>;
  }

  if (isTrap && state.trapResult) {
    const { dismantled, succeeded } = state.trapResult;
    const dead = state.playerHp <= 0;

    // Dismantled or dead — just advance out
    if (dismantled || dead) {
      return <GlassButton onClick={() => advance()}>Continue</GlassButton>;
    }

    // Not yet attempted, or failed — can try again or skip
    return (
      <>
        <GlassButton onClick={() => dispatch({ type: "dismantle" })}>
          {succeeded === false ? "Try Again" : "Dismantle"}
        </GlassButton>
        <GlassButton onClick={() => advance()}>Skip</GlassButton>
      </>
    );
  }

  if (isVictory || isGameOver) {
    return <GlassButton onClick={() => advance()}>Play Again</GlassButton>;
  }

  return null;
}

// --- Inventory Panel ---

function groupItems(items: Item[]) {
  const groups: { item: Item; count: number; firstIndex: number }[] = [];
  items.forEach((item, i) => {
    const existing = groups.find((g) => g.item.name === item.name);
    if (existing) {
      existing.count++;
    } else {
      groups.push({ item, count: 1, firstIndex: i });
    }
  });
  return groups;
}

function InventoryPanel({
  state,
  isExploring,
  dispatch,
}: {
  state: DungeonCrawlState;
  isExploring: boolean;
  dispatch: (cmd: DungeonCrawlCommand) => void;
}) {
  const hasItems = state.inventory.length > 0 || state.equipment.length > 0;
  const consumableGroups = groupItems(state.inventory);
  const equipmentGroups = groupItems(state.equipment);

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30 backdrop-blur">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">
        Inventory
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!hasItems && <p className="text-xs text-stone-500">No items yet.</p>}

        {consumableGroups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-stone-300">
              Consumables
            </h3>
            {consumableGroups.map(({ item, count, firstIndex }) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-stone-200">
                    {item.name}
                    {count > 1 && (
                      <span className="ml-1 text-stone-500">x{count}</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    Heals {item.value} HP
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isExploring}
                  onClick={() =>
                    dispatch({ type: "useItem", index: firstIndex })
                  }
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-pink-400 transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        )}

        {equipmentGroups.length > 0 && (
          <div
            className={clsx(
              "space-y-2",
              consumableGroups.length > 0 &&
                "mt-4 border-t border-white/10 pt-3",
            )}
          >
            <h3 className="text-xs font-semibold text-stone-300">Equipment</h3>
            {equipmentGroups.map(({ item, count }) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-sm" aria-hidden>
                  {item.type === "weapon" ? "\u2694" : "\u26E8"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-stone-200">
                    {item.name}
                    {count > 1 && (
                      <span className="ml-1 text-stone-500">x{count}</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    {item.type === "weapon"
                      ? `ATK +${item.value * count}`
                      : `DEF +${item.value * count}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Combat Panel ---

function CombatPanel({ combat }: { combat: CombatState }) {
  const hpPercent = (combat.monsterCurrentHp / combat.monster.hp) * 100;

  return (
    <div className="space-y-3 text-white">
      <h2 className="text-xl font-bold">{combat.monster.name}</h2>

      <div className="space-y-1">
        <div className="h-3 overflow-hidden rounded-full bg-stone-700">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <p className="text-xs text-stone-400 tabular-nums">
          HP: {combat.monsterCurrentHp}/{combat.monster.hp}
        </p>
      </div>

      <div className="space-y-1 text-sm text-stone-300">
        {combat.lastPlayerRoll !== null && combat.playerHit !== null && (
          <p>
            <span className="text-blue-400">You</span> rolled{" "}
            <strong>{combat.lastPlayerRoll}</strong>
            {combat.playerHit
              ? ` — Hit for ${combat.lastPlayerDamage} damage!`
              : " — Miss!"}
          </p>
        )}
        {combat.lastPlayerRoll !== null && combat.playerHit === null && (
          <p>
            <span className="text-blue-400">You</span> tried to flee — rolled{" "}
            <strong>{combat.lastPlayerRoll}</strong>
            {combat.fled ? " — Escaped!" : " — Blocked!"}
          </p>
        )}
        {combat.lastMonsterRoll !== null && (
          <p>
            <span className="text-red-400">{combat.monster.name}</span> rolled{" "}
            <strong>{combat.lastMonsterRoll}</strong>
            {combat.monsterHit
              ? ` — Hit for ${combat.lastMonsterDamage} damage!`
              : " — Miss!"}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Treasure Panel ---

function TreasurePanel({
  item,
  message,
}: {
  item: Item;
  message: string | null;
}) {
  const iconColor =
    item.type === "healthPotion"
      ? "text-pink-400"
      : item.type === "weapon"
        ? "text-orange-400"
        : "text-cyan-400";

  return (
    <div className="space-y-2 text-center text-white">
      <h2 className="text-xl font-bold text-yellow-400">Treasure!</h2>
      <p className={clsx("text-2xl", iconColor)}>
        {item.type === "healthPotion" && "\u2661"}
        {item.type === "weapon" && "\u2694"}
        {item.type === "shield" && "\u26E8"}
      </p>
      <p className="text-stone-300">{message}</p>
    </div>
  );
}

// --- Trap Panel ---

function TrapPanel({
  result,
  message,
}: {
  result: TrapResult;
  message: string | null;
}) {
  return (
    <div className="space-y-3 text-center text-white">
      <h2 className="text-xl font-bold text-orange-400">Trap!</h2>
      <p className="text-sm text-stone-400">
        Reward: <span className="text-stone-200">{result.rewardItem.name}</span>
      </p>
      {result.roll !== null && (
        <p className="text-3xl">{result.dismantled ? "\u2714" : "\u2716"}</p>
      )}
      <p className="text-stone-300">{message}</p>
      {result.damage > 0 && !result.dismantled && (
        <p className="text-xs text-red-400">
          Total damage taken: {result.damage}
        </p>
      )}
    </div>
  );
}

// --- Message Log ---

function MessageLog({ log }: { log: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30 backdrop-blur">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">
        Log
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1.5">
          {log.map((entry, i) => (
            <p
              key={i}
              className={clsx(
                "text-xs leading-relaxed",
                entry.startsWith("---")
                  ? "mt-2 font-semibold text-stone-200"
                  : "text-stone-400",
              )}
            >
              {entry}
            </p>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}

// --- Export ---

export default withStateMachineContext(
  DungeonCrawl,
  dungeonCrawlConfig,
  initialState,
  { autostart: true },
);
