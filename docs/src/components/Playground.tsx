import {
  apply,
  init,
  legalInputs,
  type ApplyResult,
  type GameEvent,
  type Input,
} from "@drock07/board-game-toolkit-engine";
import { FlowGraph } from "@drock07/board-game-toolkit-react/devtools";
import { demos } from "board-game-toolkit-examples/demos";
import { describeEvent } from "board-game-toolkit-examples/site/flowTree";
import { JsonView } from "board-game-toolkit-examples/site/JsonView";
import { StrictMode, useState } from "react";

/** A short label for an input's answer. */
function label(input: Input, prompt: { label?: string }): string {
  if ("action" in input) {
    return input.args === undefined
      ? input.action
      : `${input.action} ${JSON.stringify(input.args)}`;
  }
  if ("choose" in input) return input.choose.map(String).join(" + ");
  return prompt.label ?? "Continue";
}

let seedCount = 0;
const nextSeed = () => `playground-${++seedCount}`;

function Demo({ name }: { name: string }) {
  const demo = demos[name];
  if (!demo) throw new Error(`No demo called "${name}"`);
  const { game, players } = demo;
  const start = () => init(game, { players, seed: nextSeed() });
  const [res, setRes] = useState<ApplyResult>(start);
  const [log, setLog] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = (input: Input) => {
    const next = apply(game, res.state, input);
    if (!next.ok) {
      setError(next.error.message);
      return;
    }
    setError(null);
    setRes(next);
    setLog((l) => [...next.events, ...l].slice(0, 40));
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-panel text-ink">
      <div className="overflow-x-auto border-b border-line bg-page p-4">
        <FlowGraph game={game} flow={res.state.flow} />
      </div>
      <div className="grid gap-px bg-line md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-label="Prompts"
          className="flex flex-col gap-3 bg-panel p-4"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">Open prompts</span>
            <button
              type="button"
              onClick={() => {
                setRes(start());
                setLog([]);
                setError(null);
              }}
              className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium hover:bg-well"
            >
              Restart
            </button>
          </div>
          {res.prompts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-accent-line bg-accent-soft/50 p-3"
            >
              <div className="font-mono text-xs text-muted">
                <span className="font-semibold text-accent">{p.node}</span> ·{" "}
                {p.kind} · {p.actors.join(", ")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.actors.flatMap((player) =>
                  legalInputs(game, res.state, player)
                    .filter((i) => i.prompt === p.id)
                    .map((input) => (
                      <button
                        key={`${player}:${JSON.stringify(input)}`}
                        type="button"
                        onClick={() => submit(input)}
                        className="rounded-md border border-line-strong bg-panel px-2.5 py-1 font-mono text-xs hover:border-accent hover:text-accent"
                      >
                        {players.length > 1 && (
                          <span className="text-subtle">{player}: </span>
                        )}
                        {label(input, p)}
                      </button>
                    )),
                )}
              </div>
            </div>
          ))}
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Vars</span>
            <JsonView value={res.state.vars} />
          </div>
        </section>
        <section
          aria-label="Events"
          className="flex flex-col gap-2 bg-panel p-4"
        >
          <span className="eyebrow">Last events, newest first</span>
          {log.length ? (
            <ol className="flex max-h-72 flex-col gap-0.5 overflow-y-auto font-mono text-xs">
              {log.map((e) => (
                <li
                  key={e.seq}
                  className={e.type === "flow" ? "text-label" : "text-ink-2"}
                >
                  {describeEvent(e)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-subtle">
              Answer a prompt to see events.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * A reference page's live demo: the flow graph, every open prompt with a
 * button per legal input (for every seat), the vars, and recent events.
 */
export default function Playground({ demo }: { demo: string }) {
  return (
    <StrictMode>
      <Demo name={demo} />
    </StrictMode>
  );
}
