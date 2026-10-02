import { FlowGraph } from "@drock07/board-game-toolkit-react/devtools";
import { catalog } from "board-game-toolkit-examples/catalog";
import { games } from "board-game-toolkit-examples/registry";
import { href } from "../lib/links";

/** Every example's flow, drawn by the devtools' FlowGraph. */
export default function FlowGallery() {
  const entries = catalog.filter((e) => e.slug in games);
  return (
    <div className="flex flex-col gap-10">
      {entries.map((e) => (
        <section
          key={e.slug}
          aria-labelledby={`flow-${e.slug}`}
          className="flex flex-col gap-3"
        >
          <div className="flex items-baseline gap-3">
            <h2
              id={`flow-${e.slug}`}
              className="text-xl font-semibold text-ink"
            >
              {e.title}
            </h2>
            <a
              href={href(`examples/${e.slug}/`)}
              className="text-sm text-accent hover:text-accent-hover"
            >
              Play →
            </a>
          </div>
          <div className="overflow-x-auto rounded-[10px] border border-line bg-panel p-4">
            <FlowGraph game={games[e.slug]!} />
          </div>
        </section>
      ))}
    </div>
  );
}
