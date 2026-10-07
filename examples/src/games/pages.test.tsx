// @vitest-environment jsdom
// Each ported game's page renders inside the site frame, with its devtools
// open, and gets as far as its first input without throwing.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { catalog } from "../catalog";
import { EntryContext } from "../site/GameFrame";

afterEach(cleanup);

/** Games whose pages are ported so far; the rest join as they're ported. */
const PORTED = new Set([
  "tic-tac-toe",
  "sandbox",
  "blackjack",
  "crazy-eights",
  "sealed-bids",
]);

describe.each(catalog.filter((e) => PORTED.has(e.slug)))(
  "$title page",
  (entry) => {
    test("renders, opens devtools, and restarts", async () => {
      render(
        <EntryContext value={entry}>
          <Suspense fallback="loading">
            <entry.Page />
          </Suspense>
        </EntryContext>,
      );
      expect(
        await screen.findByRole("region", { name: entry.title }),
      ).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Devtools" }));
      });
      expect(screen.getByRole("figure", { name: "Game flow" })).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByRole("tab", { name: "Fibers" }));
      });
      expect(screen.getAllByLabelText(/^Fiber /).length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Restart" }));
      });
    });
  },
);
