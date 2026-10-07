// The Devtools guide's sample: the flow graph and fiber inspector next to a
// running game, here the simultaneous demo, where each player has a fiber.
import { useGame } from "@drock07/board-game-toolkit-react";
import {
  FiberInspector,
  FlowGraph,
} from "@drock07/board-game-toolkit-react/devtools";
import { game } from "../demos/simultaneous";

// #region debug
export function Debug() {
  const g = useGame(game, { players: ["p1", "p2"], seed: "debug" });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* g.state is the committed state; a view leaves out the flow's frames */}
      <FlowGraph game={game} state={g.state} />
      <FiberInspector game={game} state={g.state} />
    </div>
  );
}
// #endregion debug
