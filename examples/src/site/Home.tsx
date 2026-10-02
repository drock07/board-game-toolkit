import { Link } from "react-router";
import { catalog, type CatalogEntry } from "../catalog";
import { thumbMarkup } from "./thumbs";

function Thumb({ slug }: { slug: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-30 w-45"
      aria-hidden
      // Constant markup from thumbs.ts, never user input
      dangerouslySetInnerHTML={{ __html: thumbMarkup(slug) }}
    />
  );
}

function GameCard({ entry }: { entry: CatalogEntry }) {
  return (
    <Link
      to={`/${entry.slug}`}
      className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-panel transition hover:border-divider hover:shadow-[0_4px_16px_rgba(24,24,27,.06)] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex h-37.5 items-center justify-center border-b border-line bg-well">
        <Thumb slug={entry.slug} />
      </div>
      <div className="flex flex-col gap-2 px-4.5 pt-4 pb-4.5">
        <h3 className="text-base font-semibold">{entry.title}</h3>
        <p className="text-sm/normal text-pretty text-muted">{entry.desc}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {entry.tags.map((t) => (
            <span
              key={t}
              className="rounded border border-line bg-well px-1.5 py-0.5 font-mono text-[11px] text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Section({
  title,
  blurb,
  entries,
}: {
  title: string;
  blurb: string;
  entries: CatalogEntry[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-sm text-subtle">{blurb}</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((e) => (
          <GameCard key={e.slug} entry={e} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="h-full overflow-y-auto">
      <div className="flex flex-col gap-12 px-4 py-10 sm:px-16 sm:py-14">
        <header className="flex max-w-180 flex-col gap-4">
          <h1 className="text-[40px]/[1.1] font-semibold tracking-[-0.02em]">
            Examples
          </h1>
          <p className="text-[17px]/[1.55] text-pretty text-muted">
            Playable games built with the toolkit&rsquo;s engine and React host.
            Each page shows the live flow, the viewer&rsquo;s view and its
            events next to the game.
          </p>
          <div className="flex items-center gap-3 overflow-x-auto rounded-lg bg-code px-4 py-3 font-mono text-[13px] whitespace-nowrap text-on-code">
            <span className="text-label">$</span>
            <span>
              pnpm add @drock07/board-game-toolkit-engine
              @drock07/board-game-toolkit-react
            </span>
          </div>
        </header>
        <Section
          title="Concepts"
          blurb="Interactive demos of core toolkit features."
          entries={catalog.filter((e) => e.group === "Concepts")}
        />
        <Section
          title="Games"
          blurb="Sample games built with Board Game Toolkit."
          entries={catalog.filter((e) => e.group === "Examples")}
        />
      </div>
    </main>
  );
}
