// The Animating events guide's claims, on the headless host: events play
// back one at a time, the view lags the commit until they're done, and the
// flow event is where what nodes show (`view.shown`) catches up.
import { turnNode, view as viewOf } from "@drock07/board-game-toolkit-engine";
import { GameHost } from "@drock07/board-game-toolkit-react";
import { expect, test } from "vitest";
import { roll, rollFive } from "../games/roll-five";

/** Resolves once the host has nothing left to play back. */
const settled = (host: GameHost<unknown, unknown>) =>
  new Promise<void>((resolve) => {
    const check = () => {
      if (!host.getSnapshot().playing) {
        stop();
        resolve();
      }
    };
    const stop = host.subscribe(check);
    check();
  });

test("events play back one at a time, and the flow event updates what nodes show", async () => {
  // #region host
  const host = new GameHost(rollFive, { players: ["p1"], seed: "anim" });
  const seen: string[] = [];
  host.on("*", async (event, view) => {
    // The view already includes this event; the roll count is the turn's
    const rolls = turnNode.shown(view)?.counts.roll ?? 0;
    seen.push(`${event.type}: ${view.vars.dice.length} dice, ${rolls} rolls`);
    await new Promise((r) => setTimeout(r, 10)); // an animation
  });
  host.start();

  host.submit(roll.by("p1"));
  // Playback has started: the first event (the vars) is on screen, and its
  // handler is running. The rest wait for it.
  host.getSnapshot().playing; // true
  // #endregion host
  const during = host.getSnapshot();
  expect(during.playing).toBe(true);
  expect(during.view.vars.dice).toHaveLength(5);
  expect(turnNode.shown(during.view)?.counts.roll ?? 0).toBe(0);
  expect(seen).toEqual(["vars: 5 dice, 0 rolls"]);
  expect(during.view.waiting).toEqual([]);
  expect(during.legal).toEqual([]);
  expect(during.actors).toEqual([]);
  expect(
    turnNode.shown(viewOf(rollFive, during.state, "p1"))?.counts.roll,
  ).toBe(1);

  await settled(host as GameHost<unknown, unknown>);
  // The vars arrive first; the turn's count catches up with the flow event
  expect(seen).toEqual(["vars: 5 dice, 0 rolls", "flow: 5 dice, 1 rolls"]);
  const after = host.getSnapshot();
  expect(after.view.waiting).toEqual([
    { label: "Roll or score", actors: ["p1"] },
  ]);
  expect(after.legal.length).toBeGreaterThan(0);
  host.stop();
});

test("events with no handler apply without waiting", async () => {
  const host = new GameHost(rollFive, { players: ["p1"], seed: "quiet" });
  host.start();
  host.submit(roll.by("p1"));
  await settled(host as GameHost<unknown, unknown>);
  expect(host.getSnapshot().view.vars.dice).toHaveLength(5);
  expect(turnNode.shown(host.getSnapshot().view)?.counts.roll).toBe(1);
  host.stop();
});
