import { describe, expect, test } from "vitest";
import {
  branch,
  decision,
  loop,
  parallel,
  pause,
  seq,
  step,
} from "./builders.js";
import { GameDefinitionError } from "./errors.js";
import { defineGame, init } from "./game.js";
import type { GameImpl } from "./impl.js";
import { fromJSON, toJSON } from "./serialize.js";
import type { GameSpec } from "./spec.js";
import type { AnyTypes } from "./types.js";

const spec = {
  id: "json",
  version: 2,
  players: { min: 1, max: 2 },
  zones: {
    deck: { visibility: "hidden" },
    hand: { perPlayer: true, visibility: { ref: "mine" } },
  },
  vars: { n: {}, secret: { visibility: "hidden" } },
  flow: loop(
    "session",
    seq("round", [
      step("deal", "deal"),
      branch(
        "check",
        [{ when: { gte: [{ var: "vars.n" }, 1] }, then: pause("big") }],
        pause("small"),
      ),
      parallel(
        "both",
        [
          decision("a", { actor: "p1" }, { go: {} }),
          decision("b", { actor: { ref: "others" } }, { go: {} }),
        ],
        { join: "race" },
      ),
    ]),
    { exits: { stop: "tooMany" } },
  ),
  triggers: [
    {
      id: "t",
      on: { type: "moved", to: "hand" },
      when: { ref: "always" },
      flow: step("noted", "deal"),
    },
  ],
} as const satisfies GameSpec;

const impl = {
  setup(tx) {
    tx.vars = { n: 0, secret: 1 };
  },
  conditions: { tooMany: () => false, always: () => true },
  lists: { others: (s) => s.players.slice(1) },
  visibility: { mine: () => true },
  steps: { deal: () => {} },
  actions: { go: { execute: () => {} } },
} satisfies GameImpl<AnyTypes>;

describe("toJSON and fromJSON", () => {
  test("round-trip a spec, and the result defines the same game", () => {
    const text = toJSON(spec);
    expect(JSON.parse(text)).toMatchObject({
      format: "board-game-toolkit/spec",
      formatVersion: 1,
    });
    const loaded = fromJSON(text);
    expect(loaded).toEqual(spec);
    // A loaded spec is a plain GameSpec, so the impl's refs are checked at runtime
    const game = defineGame({ spec: loaded, impl });
    expect(
      init(game, { players: ["p1", "p2"], seed: "s" }).prompts.length,
    ).toBeGreaterThan(0);
  });

  const broken = (edit: (s: Record<string, unknown>) => void) => {
    const doc = JSON.parse(toJSON(spec)) as { spec: Record<string, unknown> };
    edit(doc.spec);
    return () => fromJSON(JSON.stringify(doc));
  };
  const flow = (s: Record<string, unknown>) =>
    (s.flow as { body: { children: Record<string, unknown>[] } }).body.children;

  test.each<[string, (s: Record<string, unknown>) => void, RegExp]>([
    ["a missing field", (s) => delete s.players, /spec: missing "players"/],
    [
      "an unknown field",
      (s) => (s.colour = "red"),
      /spec: unknown field "colour"/,
    ],
    [
      "a wrong type",
      (s) => (s.version = "2"),
      /spec\.version: expected a whole number/,
    ],
    [
      "a node's field",
      (s) => (flow(s)[0]!.run = 3),
      /spec\.flow\.body\.children\[0\]\.run: expected a string/,
    ],
    [
      "a typo'd node field",
      (s) => {
        flow(s)[2]!.joins = "all";
        delete flow(s)[2]!.join;
      },
      /children\[2\]: missing "join"/,
    ],
    [
      "a bad expression",
      (s) =>
        ((flow(s)[1]!.cases as { when: unknown }[])[0]!.when = { gte: [1] }),
      /cases\[0\]\.when\.gte: gte takes two operands/,
    ],
    [
      "a bad zone",
      (s) =>
        ((s.zones as Record<string, unknown>).deck = { visibility: "secret" }),
      /spec\.zones\.deck\.visibility/,
    ],
    [
      "a bad trigger",
      (s) =>
        ((s.triggers as Record<string, unknown>[])[0]!.on = { type: "rolled" }),
      /triggers\[0\]\.on: expected an event pattern/,
    ],
  ])("rejects %s, with its path", (_, edit, message) => {
    expect(broken(edit)).toThrow(GameDefinitionError);
    expect(broken(edit)).toThrow(message);
  });

  test("rejects text that isn't a spec document", () => {
    expect(() => fromJSON("{")).toThrow(/doesn't parse/);
    expect(() => fromJSON(JSON.stringify(spec))).toThrow(/Not a spec document/);
    expect(() =>
      fromJSON(
        JSON.stringify({
          format: "board-game-toolkit/spec",
          formatVersion: 9,
          spec,
        }),
      ),
    ).toThrow(/Unsupported spec format version 9/);
  });
});
