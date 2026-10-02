import {
  isHidden,
  type GameTypes,
  type Input,
  type PlayerView,
  type VisibleEntity,
} from "@drock07/board-game-toolkit-engine";

export type ActionInput = Extract<Input, { action: string }>;

/** The legal inputs for an action, from `g.legal`. */
export const actionInputs = (legal: readonly Input[], action: string) =>
  legal.filter((i): i is ActionInput => "action" in i && i.action === action);

/** The legal input for an action whose args match `where`. */
export function findInput(
  legal: readonly Input[],
  action: string,
  where: (args: Record<string, unknown>) => boolean = () => true,
): ActionInput | undefined {
  return actionInputs(legal, action).find((i) =>
    where((i.args ?? {}) as Record<string, unknown>),
  );
}

/** The input that answers an open pause. */
export const continueInput = (legal: readonly Input[]) =>
  legal.find((i) => "continue" in i);

/** A zone's entities as the viewer sees them: visible ones, or `null` for hidden. */
export function zoneCards<T extends GameTypes>(
  view: PlayerView<T>,
  zone: string,
): { id: string; entity: VisibleEntity<T> | null }[] {
  const items = (view.zones as Record<string, { items: readonly string[] }>)[
    zone
  ]?.items;
  return (items ?? []).map((id) => {
    const e = view.entities[id];
    return { id, entity: e && !isHidden(e) ? e : null };
  });
}
