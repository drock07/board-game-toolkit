// A turn: holds a prompt open across several answers, and ends when an
// action returns "end" or `until` holds. `limits` caps how many times each
// action may be taken this turn, and `first` lists the only actions allowed
// as the first answer. Per-turn counts live in the frame, so nothing in vars
// needs resetting; players see them as `turnNode.shown(view)`.
import { isExit, type Frame, type Kind, type Node } from "../types.js";

type Of<K extends string> = Extract<Node, { kind: K }>;

/** What a turn shows players: answers given this turn, in total and per action. */
export interface TurnShown {
  answers: number;
  counts: Record<string, number>;
}

const dataOf = (f: Frame): TurnShown =>
  (f.data as TurnShown | undefined) ?? { answers: 0, counts: {} };

export const turn: Kind<Of<"turn">, TurnShown> = {
  children: () => [],
  run: (n, _f, ctx) =>
    n.until !== undefined && ctx.holds(n.until) ? "done" : "wait",
  actions(n, f) {
    const { answers, counts } = dataOf(f);
    return n.actions.filter((a) => {
      if (answers === 0 && n.first && !n.first.includes(a)) return false;
      const limit = n.limits?.[a];
      return limit === undefined || (counts[a] ?? 0) < limit;
    });
  },
  answered(n, f, answer, ctx) {
    const { answers, counts } = dataOf(f);
    f.data = {
      answers: answers + 1,
      counts: { ...counts, [answer.action]: (counts[answer.action] ?? 0) + 1 },
    } satisfies TurnShown;
    if (isExit(answer.result)) return answer.result;
    return answer.result === "end" ||
      (n.until !== undefined && ctx.holds(n.until))
      ? "done"
      : "wait";
  },
  show: (_n, f) => dataOf(f),
};
