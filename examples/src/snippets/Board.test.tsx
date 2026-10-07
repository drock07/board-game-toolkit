// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Board } from "./Board";

afterEach(cleanup);

test("the board renders nine cells, and a legal click places a mark", async () => {
  // A seed where "you" moves first
  for (const seed of ["a", "b", "c", "d", "e", "f"]) {
    render(<Board seed={seed} />);
    const cells = screen.getAllByRole("button", { name: /^Cell / });
    expect(cells).toHaveLength(9);
    const open = cells.find((c) => !(c as HTMLButtonElement).disabled);
    if (!open) {
      cleanup();
      continue;
    }
    await act(async () => {
      fireEvent.click(open);
    });
    expect(open.textContent).toBe("x");
    return;
  }
  throw new Error("No seed let you move first");
});
