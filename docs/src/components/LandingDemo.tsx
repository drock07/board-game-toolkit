import { useGame } from "@drock07/board-game-toolkit-react";
import { FlowGraph } from "@drock07/board-game-toolkit-react/devtools";
import {
  crazyEights,
  simpleBot,
} from "board-game-toolkit-examples/games/crazy-eights";
import { useCrazyEightsTable } from "board-game-toolkit-examples/games/crazy-eights/Table";
import { StatusPill } from "board-game-toolkit-examples/site/GameFrame";
import { StrictMode, type ReactNode } from "react";

function Demo({ spec }: { spec: ReactNode }) {
  const g = useGame(crazyEights, {
    players: [
      "p1",
      { id: "p2", controller: simpleBot },
      { id: "p3", controller: simpleBot },
    ],
  });
  const { stats, table, actions } = useCrazyEightsTable(g);
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_8px_32px_rgba(24,24,27,.06)]">
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label="Crazy Eights" className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-4 pb-3">
            <div className="flex flex-wrap gap-6">{stats}</div>
            <div className="flex items-center gap-2">
              <StatusPill g={g} />
              <button
                type="button"
                onClick={() => g.restart()}
                className="h-8 rounded-md border border-line-strong bg-panel px-3 text-sm font-medium text-ink hover:bg-well"
              >
                Restart
              </button>
            </div>
          </div>
          <div className="relative mx-5 flex min-h-[440px] flex-1 flex-col items-center justify-between gap-5 overflow-hidden rounded-lg border border-line bg-stage p-5">
            {table}
          </div>
          <div className="flex min-h-20 flex-wrap items-center justify-center gap-2.5 px-5 py-4">
            {actions}
          </div>
        </section>
        <aside
          aria-label="The game's spec"
          className="flex min-w-0 flex-col border-t border-line lg:border-t-0 lg:border-l"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-5">
            <span className="eyebrow">crazy-eights/spec.ts</span>
            <span className="text-xs text-subtle">the whole flow, as data</span>
          </div>
          {/* Absolute on wide screens, so the game sets the row's height */}
          <div className="relative max-h-96 flex-1 overflow-auto lg:max-h-none">
            <div className="lg:absolute lg:inset-0 lg:overflow-auto">
              {spec}
            </div>
          </div>
        </aside>
      </div>
      <div className="border-t border-line bg-page px-5 pt-4 pb-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="eyebrow">Live flow</span>
          <span className="text-xs text-subtle">
            Drawn from the spec by <code className="font-mono">FlowGraph</code>:
            outlined nodes are running, filled ones wait for a player.
          </span>
        </div>
        <FlowGraph game={crazyEights} state={g.state} />
      </div>
    </div>
  );
}

/**
 * The landing page's demo: Crazy Eights against two bots, its spec, and its
 * flow graph lighting up as the game runs. `children` is the highlighted spec.
 */
export default function LandingDemo({ children }: { children?: ReactNode }) {
  return (
    <StrictMode>
      <Demo spec={children} />
    </StrictMode>
  );
}
