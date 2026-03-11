import { Route, Routes } from "react-router";
import Home from "./pages/Home";
import TicTacToe from "./pages/TicTacToe/TicTacToe";
import Blackjack from "./pages/Blackjack/Blackjack";
import Yahtzee from "./pages/Yahtzee/Yahtzee";
import CrazyEights from "./pages/CrazyEights/CrazyEights";
import DungeonCrawl from "./pages/DungeonCrawl/DungeonCrawl";

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="tictactoe" element={<TicTacToe />} />
      <Route path="blackjack" element={<Blackjack />} />
      <Route path="yahtzee" element={<Yahtzee />} />
      <Route path="dungeon-crawl" element={<DungeonCrawl />} />
      <Route path="crazy-eights" element={<CrazyEights />} />
    </Routes>
  );
}
