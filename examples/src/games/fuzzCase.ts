import type { Game, PlayerId } from "@drock07/board-game-toolkit-engine";
import {
  fuzz,
  type FuzzFailure,
} from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";

// Every ported game must fuzz clean for 1,000 seeds, which CI runs. Locally
// it runs 100 for speed; FUZZ_SEEDS overrides either. Each game has its own
// fuzz test file, so they run in parallel. Fuzz checks legality, views
// (nothing hidden leaks) and that events replay to every state and view.
const SEEDS = Number(process.env.FUZZ_SEEDS ?? (process.env.CI ? 1000 : 100));

/** Seeds per batch. Between batches the test yields, so the worker stays responsive. */
const BATCH = 50;

/** Registers a test that fuzzes `game` and expects no failures. */
export function fuzzTest<V, H>(opts: {
  game: Game<V, H>;
  players: PlayerId[];
  maxInputs: number;
}) {
  test(`fuzzes clean for ${SEEDS} seeds`, async () => {
    // One long synchronous run starves the vitest worker's RPC (its
    // "onTaskUpdate" calls time out on slow CI runners), so fuzz in batches
    const seeds = Array.from({ length: SEEDS }, (_, i) => `fuzz-${i}`);
    const failures: FuzzFailure[] = [];
    let inputs = 0;
    for (let i = 0; i < seeds.length; i += BATCH) {
      const report = fuzz(opts.game, {
        seeds: seeds.slice(i, i + BATCH),
        maxInputs: opts.maxInputs,
        players: opts.players,
      });
      failures.push(...report.failures);
      inputs += report.inputs;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(failures).toEqual([]);
    expect(inputs).toBeGreaterThan(SEEDS);
  }, 300_000);
}
