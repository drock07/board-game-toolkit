import type { PlayerId, State } from "@drock07/board-game-toolkit-engine";
import {
  flowActivity,
  type GraphGame,
} from "@drock07/board-game-toolkit-react/devtools";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useMemo, type ReactNode } from "react";
import { sourceUrl, specSource, type CatalogEntry } from "../catalog";
import { describeEvent, flowRows } from "./flowTree";
import type { FrameHost } from "./GameFrame";
import { JsonView } from "./JsonView";

function Section({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {aside && (
          <span className="font-mono text-[11px] text-label">{aside}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Chip({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "rounded border px-2 py-0.5 font-mono text-xs font-medium",
        on
          ? "border-good-line bg-good-soft text-good"
          : "border-line bg-page text-faint",
      )}
    >
      {children}
      {on && " ✓"}
    </span>
  );
}

function FlowTree({ game, state }: { game: GraphGame; state: State<unknown> }) {
  const rows = useMemo(() => flowRows(game), [game]);
  const { active, waiting } = flowActivity(game, state);
  // Show the top of the tree, and open subtrees only along the active path
  const shown = rows.filter(
    (r) => r.depth <= 1 || (r.parent !== undefined && active.has(r.parent)),
  );
  return (
    <ul className="flex flex-col" aria-label="Flow">
      {shown.map((r, i) => {
        const isWaiting = waiting.has(r.id);
        const isActive = active.has(r.id);
        return (
          <li
            key={`${r.id}-${i}`}
            title={`${r.via ? `${r.via}: ` : ""}${r.id} — ${r.meta}`}
            aria-current={isWaiting ? "step" : undefined}
            className={clsx(
              "flex items-center gap-2.5 rounded-md py-1.5 pr-2.5",
              isWaiting && "bg-accent-soft",
            )}
            style={{ paddingLeft: 10 + r.depth * 12 }}
          >
            <span
              className={clsx(
                "size-2 shrink-0 rounded-full",
                isWaiting ? "bg-accent" : isActive ? "bg-accent/50" : "bg-dot",
              )}
            />
            <span
              className={clsx(
                "min-w-0 flex-1 truncate font-mono text-[13px] font-medium",
                isWaiting
                  ? "text-accent"
                  : isActive
                    ? "text-ink"
                    : "text-ink-2",
              )}
            >
              {r.via && (
                <span className="font-normal text-label">{r.via}: </span>
              )}
              {r.id}
            </span>
            <span className="max-w-[38%] shrink-0 truncate font-mono text-[11px] text-label">
              {r.meta}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Actions({ g }: { g: FrameHost }) {
  if (g.playing)
    return <p className="text-sm text-subtle">Playing back events…</p>;
  if (g.view.status === "finished")
    return <p className="text-sm text-subtle">The game is over.</p>;
  if (!g.legal.length) {
    const others = g.view.waiting
      .map((w) => `${w.actors.join(", ")}${w.label ? ` (${w.label})` : ""}`)
      .join("; ");
    return (
      <p className="text-sm text-subtle">
        {others ? `Waiting on ${others}` : "Nothing to answer."}
      </p>
    );
  }
  // The viewer's legal actions, each with how many ways it can be taken
  const counts = new Map<string, number>();
  for (const i of g.legal)
    counts.set(i.action, (counts.get(i.action) ?? 0) + 1);
  const mine = g.view.waiting.find((w) => w.actors.includes(g.viewer));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {mine?.label && (
        <span className="font-mono text-[11px] text-label">{mine.label}</span>
      )}
      {[...counts].map(([action, n]) => (
        <Chip key={action} on>
          {action}
          {n > 1 ? ` ×${n}` : ""}
        </Chip>
      ))}
    </div>
  );
}

function ViewerPicker({
  g,
  names,
}: {
  g: FrameHost;
  names: Record<PlayerId, string>;
}) {
  const options = [...g.seats.map((s) => s.id), "spectator"];
  const label = (v: string) =>
    v === "spectator"
      ? "Spectator"
      : `${names[v] ?? v} · ${v}${g.seats.find((s) => s.id === v)?.bot ? " (bot)" : ""}`;
  return (
    <Listbox value={g.viewer} onChange={g.setViewer}>
      <div className="relative">
        <ListboxButton className="flex h-9 w-full items-center justify-between rounded-md border border-line-strong bg-panel px-3 text-left text-sm focus:outline-none data-focus:outline-2 data-focus:outline-accent">
          <span className="truncate">{label(g.viewer)}</span>
          <ChevronUpDownIcon className="size-4 text-subtle" aria-hidden />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="z-20 w-(--button-width) rounded-md border border-line bg-panel p-1 text-sm shadow-lg [--anchor-gap:4px] focus:outline-none"
        >
          {options.map((v) => (
            <ListboxOption
              key={v}
              value={v}
              className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-focus:bg-nav-active"
            >
              <CheckIcon className="invisible size-4 text-accent group-data-selected:visible" />
              {label(v)}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export function Inspector({
  g,
  entry,
  names,
  panels,
}: {
  g: FrameHost;
  entry: CatalogEntry;
  names: Record<PlayerId, string>;
  panels: { title: string; content: ReactNode }[];
}) {
  const game = g.host.game;
  const events = g.log.slice(-12).reverse();
  const files = [
    `games/${entry.slug}/game.ts`,
    `games/${entry.slug}/${entry.component}.tsx`,
  ];
  return (
    <aside
      aria-label="Inspector"
      className="flex flex-col border-t border-line bg-panel xl:w-90 xl:shrink-0 xl:overflow-hidden xl:border-t-0 xl:border-l"
    >
      <TabGroup className="flex min-h-0 flex-1 flex-col">
        <TabList className="flex h-12 shrink-0 items-stretch gap-5 border-b border-line px-5">
          {["Flow", "How it works"].map((t) => (
            <Tab
              key={t}
              className="-mb-px flex items-center border-b-2 border-transparent text-sm text-subtle focus:outline-none data-focus:text-ink data-hover:text-ink data-selected:border-ink data-selected:font-semibold data-selected:text-ink"
            >
              {t}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="min-h-0 flex-1 xl:overflow-y-auto">
          <TabPanel className="flex flex-col gap-6 p-5 focus:outline-none">
            {g.seats.length > 1 && (
              <Section title="Viewing as">
                <ViewerPicker g={g} names={names} />
              </Section>
            )}
            <Section title="Flow">
              <FlowTree game={game} state={g.state} />
            </Section>
            <Section title="Actions">
              <Actions g={g} />
            </Section>
            {panels.map((p) => (
              <Section key={p.title} title={p.title}>
                {p.content}
              </Section>
            ))}
            <Section title="Vars" aside={`as ${g.viewer}`}>
              <JsonView value={g.view.vars} />
            </Section>
            <Section title="Events" aside={`${g.log.length} seen`}>
              {events.length ? (
                <ol className="flex flex-col gap-1 font-mono text-xs">
                  {events.map((e, i) => (
                    <li
                      // Newest first; the log only grows at the end
                      key={g.log.length - i}
                      className={clsx(
                        "truncate",
                        e.type === "vars" || e.type === "flow"
                          ? "text-label"
                          : "text-ink-2",
                      )}
                      title={describeEvent(e)}
                    >
                      {describeEvent(e)}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-subtle">No events yet.</p>
              )}
            </Section>
            <Section title="Source" aside={`seed ${g.seed}`}>
              <div className="flex flex-col gap-1.5">
                {files.map((f) => (
                  <a
                    key={f}
                    href={sourceUrl(f)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[13px] text-accent hover:text-accent-hover"
                  >
                    {f.slice(6)} ↗
                  </a>
                ))}
              </div>
            </Section>
          </TabPanel>
          <TabPanel className="flex flex-col gap-6 p-5 focus:outline-none">
            <div className="flex flex-col gap-3 text-sm/relaxed text-muted">
              {entry.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
            <Section title="game.ts">
              <pre className="overflow-x-auto rounded-lg bg-code px-3.5 py-3 font-mono text-xs/[1.6] text-on-code">
                {specSource(entry.slug)}
              </pre>
            </Section>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </aside>
  );
}
