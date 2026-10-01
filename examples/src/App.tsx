import type { ComponentType } from "react";
import { Route, Routes, useSearchParams } from "react-router";
import Blackjack from "./pages/Blackjack/Blackjack";
import GenericCardGame from "./pages/Concepts/GenericCardGame/GenericCardGame";
import CrazyEights from "./pages/CrazyEights/CrazyEights";
import DungeonCrawl from "./pages/DungeonCrawl/DungeonCrawl";
import Home from "./pages/Home";
import RollFive from "./pages/RollFive/RollFive";
import TicTacToe from "./pages/TicTacToe/TicTacToe";
import TowerBattler from "./pages/TowerBattler/TowerBattler";

/**
 * Passes `?seed=` from the URL to a game, so a session can be reproduced.
 * Keyed on the seed, so changing it starts a fresh engine.
 */
function SeededRoute({
  game: Game,
}: {
  game: ComponentType<{ seed?: number }>;
}) {
  const [params] = useSearchParams();
  const raw = params.get("seed");
  const seed = raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined;
  return <Game key={raw ?? ""} seed={seed} />;
}

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="card-pools" element={<GenericCardGame />} />
      <Route path="tictactoe" element={<SeededRoute game={TicTacToe} />} />
      <Route path="blackjack" element={<SeededRoute game={Blackjack} />} />
      <Route path="roll-five" element={<SeededRoute game={RollFive} />} />
      <Route
        path="dungeon-crawl"
        element={<SeededRoute game={DungeonCrawl} />}
      />
      <Route path="crazy-eights" element={<SeededRoute game={CrazyEights} />} />
      <Route
        path="tower-battler"
        element={<SeededRoute game={TowerBattler} />}
      />
    </Routes>
  );
}
