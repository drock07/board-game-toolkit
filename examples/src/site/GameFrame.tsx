import type { GameTypes, PlayerId } from "@drock07/board-game-toolkit-engine";
import type { UseGameResult } from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { createContext, use, type ReactNode } from "react";
import { sourceUrl, type CatalogEntry } from "../catalog";
import { Inspector } from "./Inspector";

export const EntryContext = createContext<CatalogEntry | null>(null);

/** The flow node to show in the status pill, and whether it's the viewer's. */
function status(g: UseGameResult): { label: string; mine: boolean } {
  if (g.playing) return { label: "playing back", mine: false };
  if (g.view.status === "finished") return { label: "finished", mine: false };
  const mine = g.prompts[0];
  if (mine) return { label: mine.node, mine: true };
  const other = g.view.prompts[0];
  if (other)
    return { label: `${other.node} · ${other.actors.join(", ")}`, mine: false };
  return { label: "running", mine: false };
}

export function StatusPill({ g }: { g: UseGameResult }) {
  const { label, mine } = status(g);
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-full border px-2.5 py-[5px] font-mono text-xs font-medium",
        mine
          ? "border-accent-line bg-accent-soft text-accent"
          : "border-line bg-well text-subtle",
      )}
    >
      <span
        className={clsx(
          "size-[7px] rounded-full",
          mine ? "bg-accent" : "bg-faint",
        )}
      />
      {label}
    </div>
  );
}

/**
 * The game page shell from the mockups: header, stats and status, the stage,
 * one row of actions, and the inspector.
 */
export function GameFrame<T extends GameTypes>({
  g,
  stats,
  above,
  actions,
  names = {},
  panels = [],
  stageClassName,
  children,
}: {
  g: UseGameResult<T>;
  stats?: ReactNode;
  /** A panel between the stats and the stage, like Roll Five's score sheet. */
  above?: ReactNode;
  actions?: ReactNode;
  /** Display names for seats, for the "Viewing as" picker. */
  names?: Record<PlayerId, string>;
  /** Game-specific inspector sections, like a game log. */
  panels?: { title: string; content: ReactNode }[];
  stageClassName?: string;
  children: ReactNode;
}) {
  const entry = use(EntryContext)!;
  // The frame reads only what every game has
  const host = g as unknown as UseGameResult;
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-chrome px-4 sm:px-7">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2.5 text-sm"
        >
          <span className="text-subtle">{entry.group}</span>
          <span className="text-divider" aria-hidden>
            /
          </span>
          <span className="font-semibold">{entry.title}</span>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => host.restart()}
            className="h-9 rounded-md border border-line-strong bg-panel px-3.5 text-sm font-medium hover:bg-well"
          >
            Restart
          </button>
          <a
            href={sourceUrl(`games/${entry.slug}`)}
            target="_blank"
            rel="noreferrer"
            className="hidden h-9 items-center rounded-md border border-line-strong bg-panel px-3.5 text-sm font-medium hover:bg-well sm:flex"
          >
            View source ↗
          </a>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
        <section
          aria-label={entry.title}
          className="flex min-w-0 flex-1 flex-col xl:min-h-0 xl:overflow-y-auto"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-7">
            <div className="flex flex-wrap gap-7">{stats}</div>
            <StatusPill g={host} />
          </div>
          {above && <div className="px-4 pb-4 sm:px-7">{above}</div>}
          <div
            className={clsx(
              "relative mx-4 flex min-h-[460px] flex-1 flex-col items-center justify-center gap-6 overflow-hidden rounded-xl border border-line bg-stage p-6 sm:mx-7",
              stageClassName,
            )}
          >
            {children}
          </div>
          <div className="flex min-h-22 flex-wrap items-center justify-center gap-2.5 px-4 pt-5 pb-6 sm:px-7">
            {actions}
          </div>
        </section>
        <Inspector g={host} entry={entry} names={names} panels={panels} />
      </div>
    </div>
  );
}
