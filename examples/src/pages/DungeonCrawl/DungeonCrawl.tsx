import { withStateMachineContext } from "@drock07/board-game-toolkit-react";
import PageLayout from "../../components/PageLayout";
import { dungeonCrawlConfig, initialState } from "./config";

export function DungeonCrawl() {
  return (
    <PageLayout title="Dungeon Crawl">
      <p className="text-gray-500">Coming soon.</p>
    </PageLayout>
  );
}

export default withStateMachineContext(
  DungeonCrawl,
  dungeonCrawlConfig,
  initialState,
  { autostart: true },
);
