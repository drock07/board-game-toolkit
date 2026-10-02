import type { Bot, Input } from "@drock07/board-game-toolkit-engine";
import { COLORS, hand, type Color, type Types } from "./impl";

/**
 * Plays its first playable card, preferring non-eights; after an eight, picks
 * the color it holds most of. Draws or passes when it must.
 */
export const simpleBot: Bot<Types> = (
  state,
  prompt,
  { player, legal, random },
) => {
  if (prompt.node === "wildColor") {
    const counts = new Map<Color, number>(COLORS.map((c) => [c, 0]));
    for (const e of hand({ state }, player)) {
      counts.set(e.props.color, counts.get(e.props.color)! + 1);
    }
    const best = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
    return (
      legal.find((i) => "choose" in i && i.choose[0] === best) ??
      random.pick(legal)
    );
  }
  if (prompt.node === "turn") {
    const plays = legal.filter(
      (i): i is Extract<Input, { action: string }> =>
        "action" in i && i.action === "playCard",
    );
    const card = (i: (typeof plays)[number]) =>
      state.entities[(i.args as { card: string }).card]!.props;
    const nonEight = plays.find((i) => card(i).value !== 8);
    return nonEight ?? plays[0] ?? legal[0]!;
  }
  return random.pick(legal);
};
