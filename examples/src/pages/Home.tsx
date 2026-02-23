import type { ReactNode } from "react";
import { Link, type To } from "react-router";
import PageLayout from "../components/PageLayout";
import TicTacToePreview from "./TicTacToe/TicTacToePreview";

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
        <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-400">
          More coming soon
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
