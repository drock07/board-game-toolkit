import {
  viewEntities,
  type GameInput,
} from "@drock07/board-game-toolkit-engine";
import type { SyncBot } from "@drock07/board-game-toolkit-engine/testing";
import {
  card,
  COLORS,
  hand,
  type Color,
  type crazyEights,
  type Vars,
} from "./game";

/**
 * Plays its first playable card, preferring non-eights; after an eight, calls
 * the color it holds most of. Draws or passes when it must. It sees only its
 * own view: its hand is the one zone it can see into.
 */
export const simpleBot: SyncBot<Vars, GameInput<typeof crazyEights>> = (
  legal,
  { view, player, random },
) => {
  const mine = viewEntities(view, hand.of(player)).filter(card.is);
  const colors = legal.filter((i) => i.action === "setColor");
  if (colors.length) {
    const counts = new Map<Color, number>(COLORS.map((c) => [c, 0]));
    for (const { props } of mine)
      counts.set(props.color, counts.get(props.color)! + 1);
    const best = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
    return colors.find((i) => i.args.color === best) ?? random.pick(legal);
  }
  // A turn: play a non-eight if it can, else an eight, else draw or pass
  const plays = legal.filter((i) => i.action === "playCard");
  const isEight = (id: string) =>
    mine.find((e) => e.id === id)?.props.value === 8;
  return (
    plays.find((i) => !isEight(i.args.card)) ??
    plays[0] ??
    legal.find((i) => i.action !== "again") ??
    random.pick(legal)
  );
};
