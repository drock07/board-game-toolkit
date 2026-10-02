import {
  catalog,
  type CatalogEntry,
} from "board-game-toolkit-examples/catalog";
import { href } from "../lib/links";
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
    <a
      href={href(`examples/${entry.slug}/`)}
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
    </a>
  );
}

/** Cards for every example game, linking to its page. */
export default function ExampleGallery() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {catalog.map((e) => (
        <GameCard key={e.slug} entry={e} />
      ))}
    </div>
  );
}
