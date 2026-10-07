// Kinds that wait for input: one player, everyone, anyone, and fibers.
import { isExit, type Kind, type Node, type PlayerId } from "../types.js";

type Of<K extends string> = Extract<Node, { kind: K }>;

/** Waits for the current player to take one of its actions. */
export const prompt: Kind<Of<"prompt">> = {
  children: () => [],
  run: () => "wait",
  actions: (n) => n.actions,
  answered: (_n, _f, answer) =>
    isExit(answer.result) ? answer.result : "done",
};

interface EveryoneData {
  answered: PlayerId[];
}

/** Waits for every player to take one of its actions, in any order, once each. */
export const everyone: Kind<Of<"everyone">> = {
  children: () => [],
  run: () => "wait",
  actors: (_n, f, { state }) => {
    const { answered } = (f.data as EveryoneData | undefined) ?? {
      answered: [],
    };
    return state.players.filter((p) => !answered.includes(p));
  },
  actions(n, f, player) {
    const { answered } = (f.data as EveryoneData | undefined) ?? {
      answered: [],
    };
    return answered.includes(player) ? [] : n.actions;
  },
  answered(_n, f, answer, ctx) {
    const answered = [
      ...((f.data as EveryoneData | undefined)?.answered ?? []),
      answer.player,
    ];
    f.data = { answered } satisfies EveryoneData;
    if (isExit(answer.result)) return answer.result;
    return answered.length >= ctx.state.players.length ? "done" : "wait";
  },
};

/**
 * Waits for one answer from any of `who` (every player when absent); the
 * first answer ends it. Which actions each of them may take is the
 * actions' own legality, so the kind offers all of them to everyone.
 */
export const anyone: Kind<Of<"anyone">> = {
  children: () => [],
  run: () => "wait",
  actors: (n, _f, ctx) =>
    n.who === undefined ? ctx.state.players : (ctx.query(n.who) as PlayerId[]),
  actions: (n) => n.actions,
  answered: (_n, _f, answer) =>
    isExit(answer.result) ? answer.result : "done",
};

/** Runs its body once per player, all at once, each on its own fiber bound to that player. */
export const simultaneous: Kind<Of<"simultaneous">> = {
  children: (n) => [n.body],
  run: (n, f, ctx) =>
    f.i === 0
      ? { spawn: ctx.state.players.map((player) => ({ node: n.body, player })) }
      : "done",
};
