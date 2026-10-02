// Code from the Spec reference pages, run as tests.
import {
  defineGame,
  describeCond,
  fromJSON,
  toJSON,
  type Expr,
} from "@drock07/board-game-toolkit-engine";
import { expect, test } from "vitest";
import { impl } from "../games/tic-tac-toe/impl";
import { spec } from "../games/tic-tac-toe/spec";

test("specs to and from JSON", () => {
  // #region json
  // Save: a format marker and the spec, as pretty-printed JSON
  const text = toJSON(spec);

  // Load: checks the document's shape and lists every problem with its path
  const loaded = fromJSON(text);

  // Then join it with the rules as usual
  const game = defineGame({ spec: loaded, impl });
  // #endregion json
  expect(game.spec).toEqual(spec);
  expect(JSON.parse(text)).toMatchObject({
    format: "board-game-toolkit/spec",
    formatVersion: 1,
  });
  // #region jsonError
  try {
    fromJSON(
      '{ "format": "board-game-toolkit/spec", "formatVersion": 1, "spec": { "id": "x" } }',
    );
  } catch {
    // GameDefinitionError: Invalid spec JSON:
    //   spec: missing "version"
    //   spec: missing "players"
    //   spec: missing "zones"
    //   spec: missing "flow"
  }
  // #endregion jsonError
  expect(() =>
    fromJSON(
      '{ "format": "board-game-toolkit/spec", "formatVersion": 1, "spec": { "id": "x" } }',
    ),
  ).toThrow(
    'Invalid spec JSON:\n  spec: missing "version"\n  spec: missing "players"\n  spec: missing "zones"\n  spec: missing "flow"',
  );
});

test("describeCond", () => {
  // #region describe
  const busted: Expr = {
    and: [{ gt: [{ var: "vars.total" }, 21] }, { not: { ref: "hasAce" } }],
  };
  describeCond(busted); // "(vars.total > 21) and not hasAce"
  // #endregion describe
  expect(describeCond(busted)).toBe("(vars.total > 21) and not hasAce");
});
