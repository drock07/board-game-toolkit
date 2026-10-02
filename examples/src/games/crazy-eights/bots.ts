import {
  isHidden,
  type Bot,
  type Input,
  type PlayerView,
} from "@drock07/board-game-toolkit-engine";
import { COLORS, type Card, type Color, type Types } from "./impl";

/** The bot's own cards, from its view: its hand is the one zone it can see into. */
function myCards(view: PlayerView<Types>, player: string): Card[] {
  const items = view.zones[`hand:${player}`]?.items ?? [];
  return items.flatMap((id) => {
    const e = view.entities[id];
    return e && !isHidden(e) ? [e.props] : [];
  });
}

/**
 * Plays its first playable card, preferring non-eights; after an eight, picks
 * the color it holds most of. Draws or passes when it must.
 */
export const simpleBot: Bot<Types> = (
  view,
  prompt,
  { player, legal, random },
) => {
  if (prompt.node === "wildColor") {
    const counts = new Map<Color, number>(COLORS.map((c) => [c, 0]));
    for (const card of myCards(view, player)) {
      counts.set(card.color, counts.get(card.color)! + 1);
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
    const isEight = (i: (typeof plays)[number]) => {
      const e = view.entities[(i.args as { card: string }).card];
      return e !== undefined && !isHidden(e) && e.props.value === 8;
    };
    return plays.find((i) => !isEight(i)) ?? plays[0] ?? legal[0]!;
  }
  return random.pick(legal);
};
