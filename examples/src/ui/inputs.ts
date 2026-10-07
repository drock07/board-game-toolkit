import {
  viewEntities,
  type Entity,
  type View,
  type ZoneRef,
} from "@drock07/board-game-toolkit-engine";

/** A legal input of the given action, from `g.legal`. */
type Of<I, N> = Extract<I, { action: N }>;

/** The legal inputs for an action, from `g.legal`. */
export const actionInputs = <
  I extends { action: string },
  N extends I["action"],
>(
  legal: readonly I[],
  action: N,
) => legal.filter((i): i is Of<I, N> => i.action === action);

/** The legal input for an action whose args match `where`. */
export function findInput<
  I extends { action: string; args: unknown },
  N extends I["action"],
>(
  legal: readonly I[],
  action: N,
  where: (args: Of<I, N>["args"]) => boolean = () => true,
): Of<I, N> | undefined {
  return actionInputs(legal, action).find((i) => where(i.args));
}

/** A zone's entities as the viewer sees them: visible ones, or `null` for hidden, keyed by ref. */
export function zoneCards<V, P>(
  view: View<V>,
  zone: ZoneRef<P>,
): { ref: string; entity: Entity<P> | null }[] {
  return viewEntities(view, zone).map((e) => ({
    ref: e.ref,
    entity: "hidden" in e ? null : e,
  }));
}
