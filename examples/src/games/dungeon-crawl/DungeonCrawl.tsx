import type {
  DeepReadonly,
  GameInput,
} from "@drock07/board-game-toolkit-engine";
import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { motion } from "motion/react";
import { dungeonCrawl } from ".";
import { GameFrame } from "../../site/GameFrame";
import { findInput } from "../../ui/inputs";
import {
  Banner,
  Button,
  Hint,
  Meter,
  Overlay,
  Panel,
  Stat,
  wait,
} from "../../ui/kit";
import { SIZE, type Room, type Vars } from "./game";

type ActionInput = GameInput<typeof dungeonCrawl>;

const ICON = {
  monster: { glyph: "⚔", cls: "text-bad", label: "Monster" },
  boss: { glyph: "☠", cls: "text-bad", label: "Dragon" },
  treasure: { glyph: "♦", cls: "text-warn", label: "Treasure" },
  trap: { glyph: "⚠", cls: "text-heat", label: "Trap" },
};

/** What a revealed room shows: its live monster, or its unclaimed item. */
function roomIcon(room: DeepReadonly<Room>) {
  if (room.type === "boss")
    return (room.monster?.hp ?? 0) > 0 ? ICON.boss : null;
  if (room.type === "monster")
    return (room.monster?.hp ?? 0) > 0 ? ICON.monster : null;
  if (room.type === "treasure" || room.type === "trap")
    return room.item ? ICON[room.type] : null;
  return null;
}

function Grid({
  vars,
  moveTo,
  onMove,
}: {
  vars: DeepReadonly<Vars>;
  moveTo: (row: number, col: number) => ActionInput | undefined;
  onMove: (input: ActionInput) => void;
}) {
  const { player, grid } = vars;
  return (
    <div className="flex w-full max-w-110 flex-col items-center gap-3.5">
      <div
        role="grid"
        aria-label="Dungeon"
        className="grid aspect-square w-full max-w-110 gap-0.5 overflow-hidden rounded-[10px] border-2 border-line-strong bg-line-strong"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${SIZE}, 1fr)`,
        }}
      >
        {grid.flatMap((row, r) =>
          row.map((room, c) => {
            const here = player.row === r && player.col === c;
            const move = moveTo(r, c);
            const icon = room.revealed ? roomIcon(room) : null;
            const label = here
              ? "You are here"
              : !room.revealed
                ? "Unexplored room"
                : (icon?.label ?? "Empty room");
            return (
              <button
                key={`${r}-${c}`}
                role="gridcell"
                type="button"
                disabled={!move}
                onClick={() => move && onMove(move)}
                aria-label={`${label}${move ? ", move here" : ""}`}
                className={clsx(
                  "flex items-center justify-center",
                  !room.revealed
                    ? "bg-fog bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(0,0,0,.035)_6px_7px)]"
                    : room.visited
                      ? "bg-well"
                      : "bg-panel",
                  move &&
                    "cursor-pointer shadow-[inset_0_0_0_3px_var(--accent)] hover:bg-accent-soft",
                )}
              >
                {here ? (
                  <motion.span
                    layoutId="hero"
                    className="size-[56%] rounded-full border-3 border-accent-line bg-accent"
                  />
                ) : (
                  icon && (
                    <span className={clsx("text-2xl", icon.cls)}>
                      {icon.glyph}
                    </span>
                  )
                )}
              </button>
            );
          }),
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted">
        {[ICON.monster, ICON.treasure, ICON.trap, ICON.boss].map((i) => (
          <span key={i.label}>
            <span className={i.cls}>{i.glyph}</span> {i.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 shadow-[inset_0_0_0_2px_var(--accent)]" />
          Can move
        </span>
      </div>
    </div>
  );
}

export default function DungeonCrawl() {
  const g = useGame(dungeonCrawl, { players: ["p1"] });
  // A beat for each move and log line, so fights read as an exchange
  useGameEvent(g, "vars", () => wait(120));

  const { vars } = g.view;
  const { player, combat, trap } = vars;
  const room = vars.grid[player.row]?.[player.col];
  const visited = vars.grid.flat().filter((r) => r.visited).length;
  const act = (name: ActionInput["action"]) => findInput(g.legal, name);
  const go = act("continue");
  const again = act("again");
  const submit = (input: ActionInput | undefined) => input && g.submit(input);

  // Potions stack by name; using one uses its first copy
  const potions = new Map<
    string,
    { count: number; value: number; index: number }
  >();
  player.inventory.forEach((item, index) => {
    const p = potions.get(item.name);
    if (p) p.count++;
    else potions.set(item.name, { count: 1, value: item.value, index });
  });

  let actions = null;
  if (act("move")) actions = <Hint>Click an adjacent room to move</Hint>;
  else if (act("attack"))
    actions = (
      <>
        <Button variant="primary" onClick={() => submit(act("attack"))}>
          Attack
        </Button>
        <Button onClick={() => submit(act("flee"))}>Flee</Button>
      </>
    );
  else if (act("dismantle"))
    actions = (
      <>
        <Button variant="primary" onClick={() => submit(act("dismantle"))}>
          Dismantle
        </Button>
        <Button onClick={() => submit(act("skip"))}>Leave it</Button>
      </>
    );
  else if (go)
    actions = (
      <Button variant="primary" onClick={() => g.submit(go)}>
        Continue
      </Button>
    );

  return (
    <GameFrame
      g={g}
      stats={
        <>
          <Stat label="HP">
            {player.hp}/{player.maxHp}
          </Stat>
          <Stat label="Rooms">
            {visited}/{SIZE * SIZE}
          </Stat>
          <Stat label="Items">
            {player.inventory.length + player.equipment.length}
          </Stat>
        </>
      }
      actions={actions}
      panels={[
        {
          title: "Log",
          content: (
            <ol className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              {vars.log
                .slice(-5)
                .reverse()
                .map((line, i) => (
                  <li
                    key={vars.log.length - i}
                    className={clsx(i > 0 && "text-subtle")}
                  >
                    {line}
                  </li>
                ))}
            </ol>
          ),
        },
      ]}
      stageClassName="lg:flex-row lg:justify-center"
    >
      <div className="flex w-full flex-col gap-3.5 lg:w-55 lg:shrink-0">
        {combat && room?.monster && (
          <Panel title="Combat">
            <Meter
              label={room.monster.name}
              value={room.monster.hp}
              max={room.monster.maxHp}
              tone="bad"
            />
            <div className="font-mono text-xs text-subtle">
              You rolled {combat.playerRoll ?? "–"} · it rolled{" "}
              {combat.monsterRoll ?? "–"}
            </div>
          </Panel>
        )}
        {trap && (
          <Panel title="Trap">
            <div className="text-[13px]">
              Guards a <span className="font-semibold">{trap.reward.name}</span>
              . Roll 12+ to dismantle it.
            </div>
            <div className="font-mono text-xs text-subtle">
              Last roll {trap.lastRoll ?? "–"} · damage taken {trap.damage}
            </div>
          </Panel>
        )}
        <Panel title="Stats">
          <Meter
            label="HP"
            value={player.hp}
            max={player.maxHp}
            tone={player.hp * 3 < player.maxHp ? "bad" : "good"}
          />
          <div className="flex flex-col gap-0.5 text-[13px]">
            <div className="flex justify-between">
              <span className="font-semibold">Attack</span>
              <span className="font-mono text-heat">+{player.attack}</span>
            </div>
            <div className="text-xs text-subtle">
              Damage: {1 + player.attack}–{6 + player.attack}
            </div>
          </div>
          <div className="flex flex-col gap-0.5 text-[13px]">
            <div className="flex justify-between">
              <span className="font-semibold">Defense</span>
              <span className="font-mono">+{player.defense}</span>
            </div>
            <div className="text-xs text-subtle">
              Enemies need {10 + player.defense}+ to hit
            </div>
          </div>
        </Panel>
        <Panel title="Inventory">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-muted">Consumables</div>
            {potions.size === 0 && (
              <div className="text-xs text-subtle">None</div>
            )}
            {[...potions].map(([name, p]) => {
              const use = findInput(
                g.legal,
                "useItem",
                (a) => a.index === p.index,
              );
              return (
                <div
                  key={name}
                  className="flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-[13px]">
                      {name} <span className="text-label">x{p.count}</span>
                    </div>
                    <div className="text-xs text-subtle">
                      Heals {p.value} HP
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!use}
                    onClick={() => submit(use)}
                    className="h-8 rounded-md border border-line-strong bg-panel px-3 text-[13px] font-medium enabled:hover:bg-well disabled:text-faint"
                  >
                    Use
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="text-xs font-semibold text-muted">Equipment</div>
            {player.equipment.length === 0 && (
              <div className="text-xs text-subtle">None</div>
            )}
            {player.equipment.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-sm">
                  {item.type === "weapon" ? "⚔" : "⛨"}
                </span>
                <div>
                  <div className="text-[13px]">{item.name}</div>
                  <div className="text-xs text-subtle">
                    {item.type === "weapon" ? "ATK" : "DEF"} +{item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Grid
        vars={vars}
        moveTo={(row, col) =>
          findInput(g.legal, "move", (a) => a.row === row && a.col === col)
        }
        onMove={(input) => g.submit(input)}
      />
      {again && !g.playing && (
        <Overlay>
          {vars.result === "victory" ? (
            <Banner tone="win" tag="VICTORY">
              The dragon is slain.
            </Banner>
          ) : (
            <Banner tone="lose" tag="DEFEAT">
              You have fallen in the dungeon.
            </Banner>
          )}
          <div className="text-sm text-muted">
            Explored {visited} of {SIZE * SIZE} rooms.
          </div>
          <Button variant="primary" onClick={() => g.submit(again)}>
            Play again
          </Button>
        </Overlay>
      )}
    </GameFrame>
  );
}
