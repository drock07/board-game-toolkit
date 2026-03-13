import { Route, Routes } from "react-router";
import Home from "./pages/Home";
import TicTacToe from "./pages/TicTacToe/TicTacToe";
import Blackjack from "./pages/Blackjack/Blackjack";
import RollFive from "./pages/RollFive/RollFive";
import CrazyEights from "./pages/CrazyEights/CrazyEights";
import DungeonCrawl from "./pages/DungeonCrawl/DungeonCrawl";
import TowerBattler from "./pages/TowerBattler/TowerBattler";

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="tictactoe" element={<TicTacToe />} />
      <Route path="blackjack" element={<Blackjack />} />
      <Route path="roll-five" element={<RollFive />} />
      <Route path="dungeon-crawl" element={<DungeonCrawl />} />
      <Route path="crazy-eights" element={<CrazyEights />} />
      <Route path="tower-battler" element={<TowerBattler />} />
    </Routes>
  );
}
