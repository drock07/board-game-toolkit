import { useGame } from "@drock07/board-game-toolkit-react";
import { crazyEights, simpleBot } from ".";
import { GameFrame } from "../../site/GameFrame";
import { NAMES, useCrazyEightsTable } from "./Table";

export default function CrazyEights() {
  // #region host
  const g = useGame(crazyEights, {
    players: [
      "p1",
      { id: "p2", controller: simpleBot },
      { id: "p3", controller: simpleBot },
    ],
  });
  // #endregion host
  const { stats, table, actions } = useCrazyEightsTable(g);
  return (
    <GameFrame
      g={g}
      names={NAMES}
      stats={stats}
      actions={actions}
      stageClassName="justify-between"
    >
      {table}
    </GameFrame>
  );
}
