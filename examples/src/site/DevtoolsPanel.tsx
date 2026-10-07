import type { State } from "@drock07/board-game-toolkit-engine";
import {
  FiberInspector,
  FlowGraph,
  type GraphGame,
} from "@drock07/board-game-toolkit-react/devtools";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/20/solid";

/**
 * A docked panel with the live flow graph and fiber inspector. It doesn't
 * block the game, so you can play and watch the flow move.
 */
export function DevtoolsPanel({
  onClose,
  title,
  game,
  state,
}: {
  onClose: () => void;
  title: string;
  game: GraphGame;
  state: State<unknown>;
}) {
  return (
    <section
      aria-label="Devtools"
      className="flex h-[45vh] shrink-0 flex-col border-t border-line bg-panel"
    >
      <TabGroup className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-stretch gap-5 border-b border-line px-5">
          <h2 className="flex items-center eyebrow">Devtools · {title}</h2>
          <TabList className="flex items-stretch gap-5">
            {["Flow graph", "Fibers"].map((t) => (
              <Tab
                key={t}
                className="-mb-px flex items-center border-b-2 border-transparent text-sm text-subtle focus:outline-none data-focus:text-ink data-hover:text-ink data-selected:border-ink data-selected:font-semibold data-selected:text-ink"
              >
                {t}
              </Tab>
            ))}
          </TabList>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close devtools"
            className="ml-auto flex items-center text-subtle hover:text-ink"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>
        <TabPanels className="min-h-0 flex-1 overflow-auto bg-page p-5">
          <TabPanel className="focus:outline-none">
            <FlowGraph game={game} state={state} />
          </TabPanel>
          <TabPanel className="max-w-4xl focus:outline-none">
            <FiberInspector game={game} state={state} />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </section>
  );
}
