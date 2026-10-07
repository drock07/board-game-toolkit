// The "What nodes show" page's custom kind: `stage(name, body)` runs its
// body and shows players which stage of the game it is.
import {
  defaultNodes,
  define,
  type Node,
} from "@drock07/board-game-toolkit-engine";
import {
  defineNode,
  node,
  type Kind,
  type SpecNode,
} from "@drock07/board-game-toolkit-engine/kinds";

// #region kind
type StageNode = { kind: "stage"; id: string; name: string; body: SpecNode };

/** What a stage shows players. */
export interface StageShown {
  name: string;
}

const stageKind: Kind<StageNode, StageShown> = {
  children: (n) => [n.body],
  run: (n, f) => (f.i === 0 ? { pass: n.body } : "done"),
  // Published to every player as view.shown.stage while the stage runs
  show: (n) => ({ name: n.name }),
};

declare module "@drock07/board-game-toolkit-engine" {
  interface NodeBuilders<V> {
    stage: <H>(name: string, body: Node<V, H>) => Node<V, H>;
  }
}

// Passing the kind types stageNode.shown(view)
export const stageNode = defineNode("stage", {
  kind: stageKind,
  build: (name, body) =>
    node(stageKind, (l) => ({
      kind: "stage",
      id: l.id("stage"),
      name,
      body: l.visit(body),
    })),
});
// #endregion kind

const { rules, action, loop, seq, prompt, stage } = define<{
  n: number;
}>().withNodes([...defaultNodes, stageNode]);

export const next = action("next", { execute: (tx) => void tx.vars.n++ });

// #region game
export const staged = rules({
  players: 1,
  setup: (tx) => void (tx.vars = { n: 0 }),
  flow: loop(
    {},
    seq(
      stage("Setup", prompt({ label: "Set up" }, next)),
      stage("Play", prompt({ label: "Play" }, next)),
    ),
  ),
});
// #endregion game
