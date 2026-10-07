// The frames the engine pushes for effects and abilities.
import type {
  AbilityScope,
  EffectData,
  GameEvent,
  Kind,
  Node,
} from "../types.js";

type Of<K extends string> = Extract<Node, { kind: K }>;

/** An effect's frame, pushed by the engine when the effect is caused. */
export const effect: Kind<Of<"effect">> = {
  children: () => [],
  run(n, f, ctx) {
    const d = f.data as EffectData;
    const event: GameEvent = { type: "custom", name: n.name, data: d.data };
    // "wait" on a kind with no actions: run again once what it queued is done
    switch (d.phase) {
      case "before":
        ctx.fire(event, "before");
        f.data = { ...d, phase: "resolve" } satisfies EffectData;
        return "wait";
      case "resolve":
        ctx.transact((tx) =>
          ctx.game.impl.effects[n.name]?.(tx, structuredClone(d.data)),
        );
        f.data = { ...d, phase: "after" } satisfies EffectData;
        return "wait";
      case "after":
        ctx.fire(event, "after");
        f.data = { ...d, phase: "done" } satisfies EffectData;
        return "wait";
      case "done":
        return "done";
    }
  },
};

/**
 * An ability's frame, pushed by the engine when the ability fires. Runs its
 * body once; binds the actor to the entity's owner and shows the body its
 * `AbilityScope` (self, owner, event).
 */
export const ability: Kind<Of<"ability">> = {
  children: (n) => [n.body],
  run: (n, f) => (f.i === 0 ? { pass: n.body } : "done"),
  actor: (_n, f) => (f.data as AbilityScope).owner,
  scope: (_n, f) => f.data,
};
