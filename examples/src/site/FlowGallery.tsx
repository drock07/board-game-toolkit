import { FlowGraph } from "@drock07/board-game-toolkit-react/devtools";
import { Link } from "react-router";
import { catalog } from "../catalog";
import { games } from "../games/registry";

/** Every example's flow, drawn by the devtools' FlowGraph. */
export default function FlowGallery() {
  const entries = catalog.filter((e) => e.slug in games);
  return (
    <main className="h-full overflow-y-auto">
      <div className="flex flex-col gap-10 px-4 py-10 sm:px-16 sm:py-14">
        <header className="flex max-w-180 flex-col gap-4">
          <h1 className="text-[40px]/[1.1] font-semibold tracking-[-0.02em]">
            Flow Gallery
          </h1>
          <p className="text-[17px]/[1.55] text-pretty text-muted">
            Every example&rsquo;s flow spec, drawn with{" "}
            <code className="font-mono text-[15px]">FlowGraph</code> from{" "}
            <code className="font-mono text-[15px]">
              @drock07/board-game-toolkit-react/devtools
            </code>
            . Sequences run left to right; branches, parallel lanes and{" "}
            <code className="font-mono text-[15px]">on</code> flows stack; loops
            are marked ↻. On a game page, the Devtools button shows the same
            graph live.
          </p>
        </header>
        {entries.map((e) => (
          <section
            key={e.slug}
            aria-labelledby={`flow-${e.slug}`}
            className="flex flex-col gap-3"
          >
            <div className="flex items-baseline gap-3">
              <h2 id={`flow-${e.slug}`} className="text-xl font-semibold">
                {e.title}
              </h2>
              <Link
                to={`/${e.slug}`}
                className="text-sm text-accent hover:text-accent-hover"
              >
                Play →
              </Link>
            </div>
            <div className="overflow-x-auto rounded-[10px] border border-line bg-page p-4">
              <FlowGraph game={games[e.slug]!} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
