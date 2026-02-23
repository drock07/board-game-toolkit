import { ReactNode } from "react";
import { Link, type To } from "react-router";

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Examples</h1>
      <p className="mt-2 text-gray-600">
        Sample games built with Board Game Toolkit.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <GameCard to="tictactoe">Tic-Tac-Toe</GameCard>
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400">
          Coming soon
        </div>
      </div>
    </div>
  );
}

function GameCard({ to, children }: { to?: To; children: ReactNode }) {
  const card = (
    <div className="flex items-center gap-3 rounded-lg border border-gray-300 p-2 text-gray-400">
      <div className="aspect-square h-20 rounded-lg bg-gray-300"></div>
      <div className="flex-1">{children}</div>
    </div>
  );

  if (!to) return card;

  return <Link to={to}>{card}</Link>;
}
