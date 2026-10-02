import type {
  Game,
  GameTypes,
  PlayerId,
} from "@drock07/board-game-toolkit-engine";
import {
  fuzz,
  type FuzzFailure,
} from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";

// Every ported game must fuzz clean for 1,000 seeds (the milestone
// criterion), which CI runs. Locally it runs 100 for speed; FUZZ_SEEDS
// overrides either. Each game has its own fuzz test file, so they run in
// parallel.
const SEEDS = Number(process.env.FUZZ_SEEDS ?? (process.env.CI ? 1000 : 100));

/** Seeds per batch. Between batches the test yields, so the worker stays responsive. */
const BATCH = 50;

/** Registers a test that fuzzes `game` and expects no failures and only `warnings`. */
export function fuzzTest<T extends GameTypes>(opts: {
  game: Game<T>;
  players: PlayerId[];
  maxInputs: number;
  warnings?: string[];
}) {
  test(`fuzzes clean for ${SEEDS} seeds`, async () => {
    // One long synchronous run starves the vitest worker's RPC (its
    // "onTaskUpdate" calls time out on slow CI runners), so fuzz in batches
    const seeds = Array.from({ length: SEEDS }, (_, i) => `fuzz-${i}`);
    const failures: FuzzFailure[] = [];
    let inputs = 0;
    // A warning holds only if it held in every batch
    let warnings: string[] | undefined;
    for (let i = 0; i < seeds.length; i += BATCH) {
      const report = fuzz(opts.game, {
        seeds: seeds.slice(i, i + BATCH),
        maxInputs: opts.maxInputs,
        players: opts.players,
      });
      failures.push(...report.failures);
      inputs += report.inputs;
      warnings = warnings
        ? warnings.filter((w) => report.warnings.includes(w))
        : report.warnings;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(failures).toEqual([]);
    expect(warnings).toEqual(opts.warnings ?? []);
    expect(inputs).toBeGreaterThan(SEEDS);
  }, 300_000);
}

/** The warning for an action that is legal but practically never reached. */
export const rarelyLegal = (action: string) =>
  `impl.actions.${action} was never legal without args; if it takes args, give it enumerate`;
