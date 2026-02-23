import { withStateMachineContext } from "@drock07/board-game-toolkit-react";
import PageLayout from "../../components/PageLayout";
import { yahtzeeConfig, initialState } from "./config";

export function Yahtzee() {
  return (
    <PageLayout title="Yahtzee">
      <p className="text-gray-500">Coming soon.</p>
    </PageLayout>
  );
}

export default withStateMachineContext(
  Yahtzee,
  yahtzeeConfig,
  initialState,
  { autostart: true },
);
