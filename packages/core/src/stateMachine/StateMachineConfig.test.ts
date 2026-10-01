import { describe, expect, it } from "vitest";
import { isTransitionSignal } from "./StateMachineConfig.js";

describe("isTransitionSignal", () => {
  it("recognizes a signal created by another copy of the package", () => {
    // A second copy can't share our TRANSITION_SIGNAL constant, but it uses
    // the same registered symbol
    const foreign = {
      [Symbol.for("board-game-toolkit.transition")]: true,
      target: "b",
      state: {},
    };
    expect(isTransitionSignal(foreign)).toBe(true);
  });

  it("rejects plain state objects", () => {
    expect(isTransitionSignal({ target: "b" })).toBe(false);
    expect(isTransitionSignal(null)).toBe(false);
  });
});
