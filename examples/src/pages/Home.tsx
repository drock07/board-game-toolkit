import type { ReactNode } from "react";
import { Link, type To } from "react-router";
import PageLayout from "../components/PageLayout";
import BlackjackPreview from "./Blackjack/BlackjackPreview";
import DungeonCrawlPreview from "./DungeonCrawl/DungeonCrawlPreview";
import TicTacToePreview from "./TicTacToe/TicTacToePreview";
import CrazyEightsPreview from "./CrazyEights/CrazyEightsPreview";
import YahtzeePreview from "./Yahtzee/YahtzeePreview";

export default function Home() {
  return (
    <PageLayout>
      <PageLayout.SafeInset />
      <div className="mx-auto mt-4 max-w-4xl px-6 text-white">
        <h1 className="text-2xl font-bold">Examples</h1>
        <p className="mt-2">Sample games built with Board Game Toolkit.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <GameCard
            to="tictactoe"
            title="Tic-Tac-Toe"
            description="A classic game vs. AI. Demonstrates nested state machines, commands, and auto-advancing states."
            preview={<TicTacToePreview />}
          />
          <GameCard
            to="blackjack"
            title="Blackjack"
            description="Card game vs. dealer. Demonstrates deck management, multiple commands per state, and auto-advancing AI."
            preview={<BlackjackPreview />}
          />
          <GameCard
            to="yahtzee"
            title="Yahtzee"
            description="Dice game with multi-phase turns. Demonstrates dice keeping/rerolling, scoring validation, and nested turns."
            preview={<YahtzeePreview />}
          />
          <GameCard
            to="dungeon-crawl"
            title="Dungeon Crawl"
            description="Board game with cards, dice, and tokens. Demonstrates deeply nested machines and complex state."
            preview={<DungeonCrawlPreview />}
          />
          <GameCard
            to="crazy-eights"
            title="Crazy Eights"
            description="Card game with custom card types. Demonstrates generic card game pools, dealing, drawing, and AI opponents."
            preview={<CrazyEightsPreview />}
          />
        </div>
      </div>
    </PageLayout>
  );
}

function GameCard({
  to,
  title,
  description,
  preview,
}: {
  to: To;
  title: string;
  description: string;
  preview: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group overflow-hidden rounded-lg border border-white/20 bg-white/10 text-white/80 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl transition ring-inset hover:border-white/40 hover:text-white"
    >
      <div className="flex items-center justify-center bg-white/40 p-6 text-white">
        {preview}
      </div>
      <div className="border-t border-white/30 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm">{description}</p>
      </div>
    </Link>
  );
}
