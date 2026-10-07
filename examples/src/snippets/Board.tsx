// The quickstart's React board: Tic-Tac-Toe against a random bot, with no
// site frame. Everything on screen comes from `useGame`.
import { randomBot } from "@drock07/board-game-toolkit-engine";
import { useGame } from "@drock07/board-game-toolkit-react";
import { again, ticTacToe } from "../games/tic-tac-toe";

// #region board
export function Board({ seed }: { seed?: string }) {
  const g = useGame(ticTacToe, {
    players: ["you", { id: "bot", controller: randomBot("bot") }],
    ...(seed !== undefined && { seed }),
  });
  const { marks, winner, tie } = g.view.vars;
  // The legal input that places a mark in a cell, if there is one
  const placeAt = (index: number) =>
    g.legal.find((i) => i.action === "placeMark" && i.args.index === index);
  const replay = g.legal.find(again.is);

  return (
    <div>
      <p>
        {winner
          ? `${winner} wins`
          : tie
            ? "A tie"
            : `Waiting on ${g.actors.join(", ")}`}
      </p>
      <div
        role="grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 3rem)" }}
      >
        {marks.map((mark, index) => {
          const input = placeAt(index);
          return (
            <button
              key={index}
              aria-label={`Cell ${index + 1}`}
              disabled={!input}
              onClick={() => input && g.submit(input)}
            >
              {mark ?? ""}
            </button>
          );
        })}
      </div>
      {replay && <button onClick={() => g.submit(replay)}>Play again</button>}
    </div>
  );
}
// #endregion board
