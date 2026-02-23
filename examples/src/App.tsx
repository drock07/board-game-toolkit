import { Route, Routes } from "react-router";
import Home from "./pages/Home";
import TicTacToe from "./pages/TicTacToe/TicTacToe";

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="tictactoe" element={<TicTacToe />} />
    </Routes>
  );
}
