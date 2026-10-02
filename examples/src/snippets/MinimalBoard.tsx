// A bare-bones Tic-Tac-Toe UI for the docs: the hook, the view and inputs,
// with no styling. The examples' own UIs build on the same three things.
import { useGame } from "@drock07/board-game-toolkit-react";
import { minimaxBot, ticTacToe } from "../games/tic-tac-toe";

// #region board
export function Board() {
  const { view, legal, submit } = useGame(ticTacToe, {
    players: ["you", { id: "bot", controller: minimaxBot }],
  });
  return (
    <div className="board">
      {view.vars.marks?.map((mark, index) => {
        // The engine lists every legal input; a cell is clickable if one targets it
        const input = legal.find(
          (i) => "action" in i && (i.args as { index: number }).index === index,
        );
        return (
          <button
            key={index}
            disabled={!input}
            onClick={() => input && submit(input)}
          >
            {mark}
          </button>
        );
      })}
    </div>
  );
}
// #endregion board
