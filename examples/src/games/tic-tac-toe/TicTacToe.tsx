import { useGame, useGameEvent } from "@drock07/board-game-toolkit-react";
import clsx from "clsx";
import { motion } from "motion/react";
import { minimaxBot, ticTacToe } from ".";
import { GameFrame } from "../../site/GameFrame";
import { continueInput, findInput } from "../../ui/inputs";
import { Button, Hint, Overlay, Stat, wait } from "../../ui/kit";
import { markOf, type Mark } from "./impl";

const NAMES = { p1: "You", p2: "Computer" };

function MarkIcon({ mark, className }: { mark: Mark; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-label={mark.toUpperCase()}
    >
      {mark === "x" ? (
        <motion.path
          d="M22 22 L78 78 M78 22 L22 78"
          className="stroke-accent"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25 }}
        />
      ) : (
        <motion.circle
          cx={50}
          cy={50}
          r={30}
          className="stroke-heat"
          strokeWidth={9}
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25 }}
        />
      )}
    </svg>
  );
}

export default function TicTacToe() {
  const g = useGame(ticTacToe, {
    players: ["p1", { id: "p2", controller: minimaxBot }],
  });
  useGameEvent(g, "vars", () => wait(150));

  const { vars, players } = g.view;
  const marks = vars.marks ?? [];
  const moves = marks.filter(Boolean).length;
  const line = new Set(vars.line ?? []);
  const prompt = g.prompts[0];
  const over = prompt?.node === "again";
  const me = markOf(players, "p1");
  const again = continueInput(g.legal);

  let result = "";
  if (vars.winner === "p1") result = "You win!";
  else if (vars.winner) result = "The computer wins.";
  else if (vars.tie) result = "It's a tie.";

  return (
    <GameFrame
      g={g}
      names={NAMES}
      stats={
        <>
          <Stat label="You">
            <MarkIcon mark={me} className="size-5.5" />
            <span className="font-sans">{vars.wins?.p1 ?? 0}</span>
          </Stat>
          <Stat label="Computer">
            <MarkIcon mark={me === "x" ? "o" : "x"} className="size-5.5" />
            <span className="font-sans">{vars.wins?.p2 ?? 0}</span>
          </Stat>
          <Stat label="Ties">{vars.ties ?? 0}</Stat>
          <Stat label="Moves">{moves}/9</Stat>
        </>
      }
      actions={
        <Hint>
          {prompt?.node === "place"
            ? "Your move — click an empty cell"
            : over
              ? result
              : "The computer is thinking…"}
        </Hint>
      }
    >
      <div
        role="grid"
        aria-label="Board"
        className="grid aspect-square w-full max-w-110 grid-cols-3 grid-rows-3"
      >
        {marks.map((m, index) => {
          const input = findInput(
            g.legal,
            "placeMark",
            (a) => a.index === index,
          );
          return (
            <div
              key={index}
              role="gridcell"
              className={clsx(
                "flex p-2.5",
                index % 3 < 2 && "border-r-4 border-line-strong",
                index < 6 && "border-b-4 border-line-strong",
              )}
            >
              <button
                type="button"
                disabled={!input}
                onClick={() => input && g.submit(input)}
                aria-label={
                  m ? `Cell ${index + 1}: ${m}` : `Place in cell ${index + 1}`
                }
                className={clsx(
                  "flex flex-1 rounded-[10px] transition-colors",
                  input && "cursor-pointer bg-page hover:bg-panel",
                  line.has(index) && "bg-accent-soft",
                )}
              >
                {m && <MarkIcon mark={m} className="size-full" />}
              </button>
            </div>
          );
        })}
      </div>
      {over && !g.playing && (
        <Overlay>
          <div className="flex flex-col gap-1.5">
            <div className="eyebrow">Game over</div>
            <div className="text-xl font-semibold">{result}</div>
          </div>
          <Button variant="primary" onClick={() => again && g.submit(again)}>
            Play again
          </Button>
        </Overlay>
      )}
    </GameFrame>
  );
}
