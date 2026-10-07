// The Dice guide's claims: rolls are typed by a die's faces, come only from
// those faces, and replay exactly from the seed.
import {
  D6,
  Fudge,
  init,
  seededRandom,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, expectTypeOf, test } from "vitest";
import {
  attack,
  combatDie,
  resourceDie,
  skirmish,
  type CombatFace,
  type Yield,
} from "./dice";

const play = (seed: string, times: number) => {
  let s = init(skirmish, { players: ["p1"], seed });
  const rolls: CombatFace[][] = [];
  for (let i = 0; i < times; i++) {
    s = applyOrThrow(skirmish, s, attack.by("p1"));
    rolls.push(s.vars.rolled);
  }
  return { rolls, wood: s.vars.wood };
};

test("a roll is typed by the die's faces", () => {
  const random = seededRandom("types");
  expectTypeOf(random.roll(combatDie)).toEqualTypeOf<CombatFace>();
  expectTypeOf(random.roll(resourceDie)).toEqualTypeOf<Yield>();
  expectTypeOf(random.roll(D6)).toEqualTypeOf<number>();
  expectTypeOf(random.roll(Fudge)).toEqualTypeOf<-1 | 0 | 1>();
});

test("rolls come from the faces, repeated faces weight them, and the seed replays them", () => {
  const { rolls, wood } = play("dice", 300);
  const all = rolls.flat();
  expect(new Set(all)).toEqual(new Set(["hit", "miss", "crit", "shield"]));
  const hits = all.filter((f) => f === "hit").length / all.length;
  expect(hits).toBeGreaterThan(0.25);
  expect(hits).toBeLessThan(0.42);
  expect(wood).toBeGreaterThan(0);
  expect(play("dice", 300)).toEqual({ rolls, wood });
  expect(play("other", 300).rolls).not.toEqual(rolls);
});

test("seededRandom rolls outside a game, the same way every time", () => {
  // #region seeded
  const random = seededRandom("table-1");
  const opening = [random.roll(D6), random.roll(D6)]; // two numbers from 1 to 6
  // #endregion seeded
  const again = seededRandom("table-1");
  expect([again.roll(D6), again.roll(D6)]).toEqual(opening);
  for (const n of opening) expect(n).toBeGreaterThanOrEqual(1);
});
