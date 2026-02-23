import type { ReactNode } from "react";
import { Link, type To } from "react-router";
import PageLayout from "../components/PageLayout";
import TicTacToePreview from "./TicTacToe/TicTacToePreview";
import BlackjackPreview from "./Blackjack/BlackjackPreview";
import YahtzeePreview from "./Yahtzee/YahtzeePreview";
import DungeonCrawlPreview from "./DungeonCrawl/DungeonCrawlPreview";

export default function Home() {
  return (
    <PageLayout>
      <h1 className="text-2xl font-bold">Examples</h1>
      <p className="mt-2 text-gray-600">
        Sample games built with Board Game Toolkit.
      </p>

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
      className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-center bg-gray-50 p-6 text-gray-400">
        {preview}
      </div>
      <div className="border-t border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-900 group-hover:text-blue-600">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}
