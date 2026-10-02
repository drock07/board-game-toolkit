import {
  defineGame,
  fromJSON,
  replay,
  toJSON,
  type GameImpl,
  type GameSpec,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import { hashState } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";

interface Golden {
  players: string[];
  seed: string;
  inputs: Input[];
  finalStateHash: string;
}

const specs = import.meta.glob<GameSpec>("./*/spec.ts", {
  import: "spec",
  eager: true,
});
const impls = import.meta.glob<GameImpl>("./*/impl.ts", {
  import: "impl",
  eager: true,
});
const goldens = import.meta.glob<Golden>("./*/golden.json", {
  import: "default",
  eager: true,
});

const games = Object.keys(specs).map((path) => path.split("/")[1]!);

test("every example has a spec, an impl and a golden replay", () => {
  expect(games).toHaveLength(9);
});

test.each(games)(
  "%s round-trips through JSON and replays its golden",
  (name) => {
    const spec = specs[`./${name}/spec.ts`]!;
    const loaded = fromJSON(toJSON(spec));
    expect(loaded).toEqual(spec);
    // Rebuilt from JSON, the game plays exactly as before
    const game = defineGame({
      spec: loaded,
      impl: impls[`./${name}/impl.ts`]!,
    });
    const golden = goldens[`./${name}/golden.json`]!;
    expect(hashState(replay(game, golden))).toBe(golden.finalStateHash);
  },
);
