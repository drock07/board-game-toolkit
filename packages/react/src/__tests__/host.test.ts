import {
  viewEntities,
  type Game,
  type GameInput,
  type ViewEvent,
} from "@drock07/board-game-toolkit-engine";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GameHost, type Bot, type GameHostOptions } from "../host.js";
import { drawGame, hand } from "./games.js";

type V = { rounds: number };
type H = typeof drawGame extends Game<V, infer H> ? H : never;
type In = GameInput<typeof drawGame>;
const draw = drawGame.action("draw");
const drawTwo = drawGame.action("drawTwo");
const host = (opts: Partial<GameHostOptions<V, H>> = {}) =>
  new GameHost(drawGame, { players: ["p1", "p2"], seed: "s", ...opts });
const handSize = (
  h: { getSnapshot(): { view: Parameters<typeof viewEntities>[0] } },
  p: string,
) => viewEntities(h.getSnapshot().view, hand.of(p)).length;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("GameHost", () => {
  test("shows who may act, the viewer's legal inputs, and what the flow waits on", () => {
    const s = host().getSnapshot();
    expect(s.viewer).toBe("p1");
    expect(s.actors).toEqual(["p1"]);
    expect(s.legal.map((i) => i.action)).toEqual(["draw", "drawTwo"]);
    expect(s.view.waiting).toEqual([{ label: "Draw", actors: ["p1"] }]);
    expect(s.playing).toBe(false);
  });

  test("returns a rejected input's reason without changing anything", () => {
    const h = host();
    const before = h.getSnapshot();
    expect(h.submit(draw.by("p2"))).toMatch(/p1's turn/);
    expect(h.getSnapshot()).toBe(before);
  });

  test("plays events back one at a time, awaiting handlers; nothing is answerable meanwhile", async () => {
    const h = host();
    h.start();
    const seen: string[] = [];
    let release!: () => void;
    h.on("moved", (e) => {
      seen.push(`${e.type}:${handSize(h, "p1")}`);
      return new Promise<void>((r) => (release = r));
    });
    expect(h.submit(drawTwo.by("p1"))).toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    // drawTwo is one move of two cards; the handler holds playback
    expect(seen).toEqual(["moved:2"]);
    let s = h.getSnapshot();
    expect(s.playing).toBe(true);
    expect(s.legal).toEqual([]);
    expect(s.actors).toEqual([]);
    expect(s.view.waiting).toEqual([]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    s = h.getSnapshot();
    expect(s.playing).toBe(false);
    expect(s.view.waiting).toEqual([{ label: "Draw", actors: ["p2"] }]);
    expect(s.actors).toEqual(["p2"]);
    // p1 isn't asked anything
    expect(s.legal).toEqual([]);
  });

  test("handlers and the log get the viewer's events: others' draws stay hidden", async () => {
    const h = host();
    h.start();
    h.submit(draw.by("p1"));
    await vi.advanceTimersByTimeAsync(0);
    const events: ViewEvent[] = [];
    h.on("*", (e) => void events.push(e));
    h.submit(draw.by("p2"));
    await vi.advanceTimersByTimeAsync(0);
    const moved = events.find((e) => e.type === "moved");
    expect(moved?.type === "moved" && "hidden" in moved.entities[0]!).toBe(
      true,
    );
    expect(events.some((e) => e.type === "effect")).toBe(false);
    expect(h.getSnapshot().log.slice(-events.length)).toEqual(events);
    expect(handSize(h, "p2")).toBe(1);
  });

  test("bots answer when their seat may act, after a delay", async () => {
    const bot = vi.fn<Bot<V, In>>((legal) => legal[0]!);
    const h = host({
      players: ["p1", { id: "p2", controller: bot }],
      botDelay: 100,
    });
    h.start();
    h.submit(draw.by("p1"));
    await vi.advanceTimersByTimeAsync(50);
    expect(bot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60);
    expect(bot).toHaveBeenCalledOnce();
    expect(bot.mock.calls[0]![1].player).toBe("p2");
    expect(bot.mock.calls[0]![1].view.player).toBe("p2");
    await vi.advanceTimersByTimeAsync(0);
    const s = h.getSnapshot();
    expect(handSize(h, "p2")).toBe(1);
    expect(s.view.waiting).toEqual([{ label: "Next round", actors: ["p1"] }]);
    await vi.advanceTimersByTimeAsync(500);
    expect(bot).toHaveBeenCalledOnce();
  });

  test("restart cancels a bot's pending answer", async () => {
    const bot = vi.fn<Bot<V, In>>((legal) => legal[0]!);
    const h = host({
      players: [{ id: "p1", controller: bot }, "p2"],
      botDelay: 100,
    });
    h.start();
    await vi.advanceTimersByTimeAsync(50);
    h.restart("t");
    expect(h.getSnapshot().seed).toBe("t");
    await vi.advanceTimersByTimeAsync(100);
    expect(bot).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    expect(handSize(h, "p1")).toBe(1);
  });

  test("a stopped host neither plays back nor runs bots", async () => {
    const bot = vi.fn<Bot<V, In>>((legal) => legal[0]!);
    const h = host({
      players: ["p1", { id: "p2", controller: bot }],
      botDelay: 10,
    });
    h.submit(draw.by("p1"));
    await vi.advanceTimersByTimeAsync(100);
    expect(h.getSnapshot().playing).toBe(true);
    expect(bot).not.toHaveBeenCalled();
    h.start();
    await vi.advanceTimersByTimeAsync(20);
    expect(bot).toHaveBeenCalledOnce();
  });

  test("spectators and bots' seats see what the flow waits on but answer nothing", () => {
    const bot: Bot<V, In> = (legal) => legal[0]!;
    const watched = host({
      players: [{ id: "p1", controller: bot }, "p2"],
      viewer: "p1",
    });
    const spectator = host({ viewer: "spectator" });
    for (const h of [watched, spectator]) {
      const s = h.getSnapshot();
      expect(s.legal).toEqual([]);
      expect(s.actors).toEqual(["p1"]);
      expect(s.view.waiting).toHaveLength(1);
    }
    expect(
      host({ players: [{ id: "p1", controller: bot }, "p2"] }).getSnapshot()
        .viewer,
    ).toBe("p2");
  });

  test("setViewer shows the new seat's view and clears the log", async () => {
    const h = host();
    h.start();
    h.submit(draw.by("p1"));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.getSnapshot().log.length).toBeGreaterThan(0);
    h.setViewer("p2");
    const s = h.getSnapshot();
    expect(s.viewer).toBe("p2");
    expect(s.log).toEqual([]);
    expect(s.view.player).toBe("p2");
    expect(s.legal.map((i) => i.action)).toEqual(["draw", "drawTwo"]);
  });
});
