import { decision, type GameSpec } from "@drock07/board-game-toolkit-engine";

/** A card-pool sandbox: one decision that never ends. */
export const spec = {
  id: "sandbox",
  version: 1,
  players: { min: 1, max: 1 },
  zones: {
    deck: { visibility: "hidden" },
    hand: { visibility: "public" },
    discard: { visibility: "public" },
  },
  flow: decision(
    "table",
    { actor: "any" },
    {
      draw: { ends: false },
      discard: { ends: false },
      shuffleBack: { ends: false },
    },
  ),
} as const satisfies GameSpec;
