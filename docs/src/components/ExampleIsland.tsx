import { entryBySlug } from "board-game-toolkit-examples/catalog";
import { EntryContext } from "board-game-toolkit-examples/site/GameFrame";
import { StrictMode, Suspense } from "react";

/** A playable example game with its inspector, as on the old examples site. */
export default function ExampleIsland({ slug }: { slug: string }) {
  const entry = entryBySlug(slug);
  if (!entry) throw new Error(`No example called "${slug}"`);
  return (
    <StrictMode>
      <EntryContext value={entry}>
        <Suspense fallback={null}>
          <entry.Page />
        </Suspense>
      </EntryContext>
    </StrictMode>
  );
}
