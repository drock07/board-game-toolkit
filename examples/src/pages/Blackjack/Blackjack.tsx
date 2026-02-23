import { withStateMachineContext } from "@drock07/board-game-toolkit-react";
import PageLayout from "../../components/PageLayout";
import { blackjackConfig, initialState } from "./config";

export function Blackjack() {
  return (
    <PageLayout title="Blackjack">
      <p className="text-gray-500">Coming soon.</p>
    </PageLayout>
  );
}

export default withStateMachineContext(
  Blackjack,
  blackjackConfig,
  initialState,
  { autostart: true },
);
