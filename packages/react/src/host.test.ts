import {
  decision,
  defineGame,
  each,
  loop,
  pause,
  prompts,
  seq,
  type AnyTypes,
  type Bot,
  type GameEvent,
  type GameImpl,
  type GameSpec,
} from "@drock07/board-game-toolkit-engine";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameHost } from "./host.js";

// Players take turns drawing from a hidden deck into hands only they can see
const spec = {
  id: "draws",
  version: 1,
  players: { min: 2, max: 2 },
  zones: {
    deck: { visibility: "hidden" },
    hand: { perPlayer: true, visibility: "owner" },
  },
  flow: loop(
    "session",
    seq("round", [
      each(
        "turns",
        { players: "clockwise" },
        decision("turn", { actor: "current" }, { draw: {}, drawTwo: {} }),
      ),
      pause("next"),
    ]),
  ),
} as const satisfies GameSpec;

const game = defineGame({
  spec,
  impl: {
    setup(tx) {
      for (let n = 0; n < 20; n++) tx.create("card", { n }, "deck");
    },
    actions: {
      draw: {
        execute: (tx) => void tx.moveTop("deck", `hand:${tx.scope.actor!}`),
      },
      drawTwo: {
        execute: (tx) => {
          tx.moveTop("deck", `hand:${tx.scope.actor!}`);
          tx.moveTop("deck", `hand:${tx.scope.actor!}`);
        },
      },
    },
  } satisfies GameImpl<AnyTypes>,
});

const draw = (h: GameHost, player = "p1") => {
  const open = prompts(game, h.getSnapshot().state).find((p) =>
    p.actors.includes(player),
  )!;
  return { prompt: open.id, player, action: "draw" };
};

const firstLegal: Bot = (_v, _p, { legal }) => legal[0]!;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("GameHost", () => {
  test("shows the viewer's prompts and legal inputs", () => {
    const h = new GameHost(game, { players: ["p1", "p2"], seed: "s" });
    const s = h.getSnapshot();
    expect(s.viewer).toBe("p1");
    expect(s.prompts.map((p) => p.node)).toEqual(["turn"]);
    expect(s.legal.map((i) => "action" in i && i.action)).toEqual([
      "draw",
      "drawTwo",
    ]);
    expect(s.playing).toBe(false);
  });

  test("returns rejected inputs' errors without changing anything", () => {
    const h = new GameHost(game, { players: ["p1", "p2"], seed: "s" });
    const before = h.getSnapshot();
    expect(h.submit({ ...draw(h), player: "p2" })).toMatchObject({
      code: "not_actor",
    });
    expect(h.getSnapshot()).toBe(before);
  });

  test("plays events back one at a time, awaiting handlers; prompts wait", async () => {
    const h = new GameHost(game, { players: ["p1", "p2"], seed: "s" });
    h.start();
    const seen: string[] = [];
    let release!: () => void;
    h.on("moved", (e) => {
      seen.push(
        `${e.type}:${h.getSnapshot().view.zones["hand:p1"]!.items.length}`,
      );
      return new Promise<void>((r) => (release = r));
    });
    expect(h.submit({ ...draw(h), action: "drawTwo" })).toBeUndefined();
    // The first move is on screen; the second waits for its handler
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(["moved:1"]);
    let s = h.getSnapshot();
    expect(s.playing).toBe(true);
    expect(s.prompts).toEqual([]);
    expect(s.legal).toEqual([]);
    expect(s.view.prompts).toEqual([]);
    expect(s.view.zones["hand:p1"]!.items).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(["moved:1", "moved:2"]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    s = h.getSnapshot();
    expect(s.playing).toBe(false);
    expect(s.view.zones["hand:p1"]!.items).toHaveLength(2);
    // p1's turn is over: p2 is up, so p1 has nothing to answer
    expect(s.prompts).toEqual([]);
    expect(s.view.prompts.map((p) => p.actors)).toEqual([["p2"]]);
  });

  test("handlers get the viewer's events: others' draws stay hidden", async () => {
    const h = new GameHost(game, {
      players: ["p1", "p2"],
      seed: "s",
      viewer: "p2",
    });
    h.start();
    const events: GameEvent[] = [];
    h.on("*", (e) => void events.push(e));
    h.submit(draw(h));
    await vi.advanceTimersByTimeAsync(0);
    const moved = events.find((e) => e.type === "moved");
    expect(moved).toMatchObject({ ids: ["?hand:p1#0"] });
    expect(h.getSnapshot().log).toEqual(events);
  });

  test("bots answer their prompts after a delay", async () => {
    const bot = vi.fn(firstLegal);
    const h = new GameHost(game, {
      players: ["p1", { id: "p2", controller: bot }],
      seed: "s",
      botDelay: 300,
    });
    h.start();
    h.submit(draw(h));
    await vi.advanceTimersByTimeAsync(299);
    expect(bot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(bot).toHaveBeenCalledOnce();
    // The bot saw only its own view
    expect(bot.mock.calls[0]![0].viewer).toBe("p2");
    await vi.advanceTimersByTimeAsync(0);
    const s = h.getSnapshot();
    expect(s.view.zones["hand:p2"]!.items).toHaveLength(1);
    // The round's pause is the human's to answer, so the bot waits
    expect(s.prompts.map((p) => p.node)).toEqual(["next"]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(bot).toHaveBeenCalledOnce();
  });

  test("restart cancels a bot's pending answer", async () => {
    const bot = vi.fn(firstLegal);
    const h = new GameHost(game, {
      players: [{ id: "p1", controller: bot }, "p2"],
      seed: "s",
      viewer: "p2",
    });
    h.start();
    await vi.advanceTimersByTimeAsync(200);
    h.restart("t");
    expect(h.getSnapshot().seed).toBe("t");
    await vi.advanceTimersByTimeAsync(500);
    // Only the new game's bot turn ran, against the new game's state
    expect(bot).toHaveBeenCalledOnce();
    expect(h.getSnapshot().view.zones["hand:p1"]!.items).toHaveLength(1);
  });

  test("a stopped host neither plays back nor runs bots", async () => {
    const bot = vi.fn(firstLegal);
    const h = new GameHost(game, {
      players: ["p1", { id: "p2", controller: bot }],
      seed: "s",
    });
    h.submit(draw(h));
    expect(h.getSnapshot().playing).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(bot).not.toHaveBeenCalled();
    h.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(bot).toHaveBeenCalledOnce();
  });

  test("spectators and bots' seats see prompts but have none to answer", () => {
    const h = new GameHost(game, {
      players: [{ id: "p1", controller: firstLegal }, "p2"],
      seed: "s",
    });
    expect(h.getSnapshot().viewer).toBe("p2");
    for (const viewer of ["spectator", "p1"]) {
      h.setViewer(viewer);
      const s = h.getSnapshot();
      expect(s.prompts).toEqual([]);
      expect(s.legal).toEqual([]);
      expect(s.view.prompts).toHaveLength(1);
    }
  });
});
