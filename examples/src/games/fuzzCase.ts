import type {
  Game,
  GameTypes,
  PlayerId,
} from "@drock07/board-game-toolkit-engine";
import { fuzz } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";

// Every ported game must fuzz clean for 1,000 seeds (the milestone
// criterion), which CI runs. Locally it runs 100 for speed; FUZZ_SEEDS
// overrides either. Each game has its own fuzz test file, so they run in
// parallel.
const SEEDS = Number(process.env.FUZZ_SEEDS ?? (process.env.CI ? 1000 : 100));

/** Registers a test that fuzzes `game` and expects no failures and only `warnings`. */
export function fuzzTest<T extends GameTypes>(opts: {
  game: Game<T>;
  players: PlayerId[];
  maxInputs: number;
  warnings?: string[];
}) {
  test(`fuzzes clean for ${SEEDS} seeds`, () => {
    const report = fuzz(opts.game, {
      seeds: SEEDS,
      maxInputs: opts.maxInputs,
      players: opts.players,
    });
    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual(opts.warnings ?? []);
    expect(report.inputs).toBeGreaterThan(SEEDS);
  }, 120_000);
}

/** The warning for an action that is legal but practically never reached. */
export const rarelyLegal = (action: string) =>
  `impl.actions.${action} was never legal without args; if it takes args, give it enumerate`;
