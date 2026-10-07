// Every example game's spec round-trips through JSON, its golden replays
// from the recorded inputs to the recorded state, and a save taken there
// loads back identical.
import {
  fromJSON,
  load,
  replayInputs,
  save,
  toJSON,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import { hashState } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { games } from "./registry";

interface Golden {
  players: string[];
  seed: string;
  inputs: Input<string, unknown>[];
  finalStateHash: string;
}

const goldens = import.meta.glob<Golden>("./*/golden.json", {
  import: "default",
  eager: true,
});

test("every example has a golden replay", () => {
  expect(
    Object.keys(goldens)
      .map((p) => p.split("/")[1])
      .sort(),
  ).toEqual(Object.keys(games).sort());
});

test.each(Object.entries(games))(
  "%s round-trips its spec, replays its golden, and saves",
  (slug, game) => {
    expect(fromJSON(toJSON(game.spec))).toEqual(game.spec);
    const golden = goldens[`./${slug}/golden.json`]!;
    const end = replayInputs(game, golden, golden.inputs);
    expect(hashState(end)).toBe(golden.finalStateHash);
    expect(load(game, save(game, end))).toEqual(end);
  },
);
