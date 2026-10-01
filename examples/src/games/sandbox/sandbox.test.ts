import {
  apply,
  init,
  replay,
  seededRandom,
  type ApplyResult,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import {
  checkInvariants,
  hashState,
  record,
} from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { sandbox } from ".";
import type { Vars } from "./impl";

type Result = ApplyResult<Vars>;

const input = (r: Result, action: string, args?: unknown): Input =>
  ({
    prompt: r.prompts[0]!.id,
    player: "p1",
    action,
    ...(args === undefined ? {} : { args }),
  }) as Input;

function ok(res: ReturnType<typeof apply<Vars>>): Result {
  if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
  return res;
}

test("draw, discard and shuffle back; the decision never ends", () => {
  let r = init(sandbox, { players: ["p1"], seed: "s" });
  expect(r.state.zones.deck!.items).toHaveLength(52);
  expect(apply(sandbox, r.state, input(r, "shuffleBack"))).toMatchObject({
    ok: false,
    error: { message: "The discard pile is empty" },
  });

  const top = r.state.zones.deck!.items[0]!;
  r = ok(apply(sandbox, r.state, input(r, "draw")));
  expect(r.state.zones.hand!.items).toEqual([top]);
  expect(
    apply(sandbox, r.state, input(r, "discard", { card: "card#999" })),
  ).toMatchObject({
    ok: false,
    error: { message: "That card isn't in your hand" },
  });
  r = ok(apply(sandbox, r.state, input(r, "discard", { card: top })));
  expect(r.state.zones.discard!.items).toEqual([top]);
  r = ok(apply(sandbox, r.state, input(r, "shuffleBack")));
  expect(r.state.zones.deck!.items).toHaveLength(52);
  expect(r.prompts).toMatchObject([{ node: "table", kind: "decision" }]);
});

test("the deck can be emptied", () => {
  let r = init(sandbox, { players: ["p1"], seed: "s" });
  for (let i = 0; i < 52; i++)
    r = ok(apply(sandbox, r.state, input(r, "draw")));
  expect(apply(sandbox, r.state, input(r, "draw"))).toMatchObject({
    ok: false,
    error: { message: "The deck is empty" },
  });
});

test("golden replay", async () => {
  const rand = seededRandom("sandbox-driver");
  const { golden, results } = record(
    sandbox,
    { players: ["p1"], seed: "golden", maxInputs: 80 },
    (r) => {
      const z = r.state.zones;
      const options: Input[] = [];
      if (z.deck!.items.length)
        options.push(input(r, "draw"), input(r, "draw"));
      for (const card of z.hand!.items)
        options.push(input(r, "discard", { card }));
      if (z.discard!.items.length) options.push(input(r, "shuffleBack"));
      return rand.pick(options);
    },
  );
  for (const res of results) expect(checkInvariants(res.state)).toEqual([]);
  expect(hashState(replay(sandbox, golden))).toBe(golden.finalStateHash);
  await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
    "./golden.json",
  );
});
