// The effects reference's claims, checked.
import {
  actors,
  apply,
  defaultNodes,
  define,
  entity,
  init,
  legalInputs,
  view,
  viewEvents,
  zone,
} from "@drock07/board-game-toolkit-engine";
import { applyOrThrow } from "@drock07/board-game-toolkit-engine/testing";
import { expect, test } from "vitest";
import { ambush, draw } from "./flowEffects";

const players = ["p1", "p2"];
const drink = ambush.action("drink");
const endure = ambush.action("endure");

/** p1 draws the Potion, p2 a Coin, then p1 draws the Trap. */
function upToTheTrap() {
  let s = init(ambush, { players, seed: "s" });
  s = applyOrThrow(ambush, s, draw.by("p1"));
  s = applyOrThrow(ambush, s, draw.by("p2"));
  return applyOrThrow(ambush, s, draw.by("p1"));
}

test("an effect with `to` is only in those players' events", () => {
  // #region whisper
  const state = init(ambush, { players, seed: "s" });
  const out = apply(ambush, state, draw.by("p1"));
  if (!out.ok) throw new Error(out.reason);
  const effectsFor = (p: string) =>
    viewEvents(ambush, out.events, p).filter((e) => e.type === "effect");
  expect(effectsFor("p1")).toEqual([
    {
      type: "effect",
      name: "drew",
      data: { player: "p1", name: "Potion" },
      to: ["p1"],
    },
  ]);
  expect(effectsFor("p2")).toEqual([]);
  // #endregion whisper
});

test("the Trap enters, causes a strike, and the game-wide ability asks its target", () => {
  // #region trap
  const state = upToTheTrap();
  // The strike waits on its `before` reaction: the target is asked
  expect(view(ambush, state, "p2").waiting).toEqual([
    { label: "Drink a potion?", actors: ["p1"] },
  ]);
  expect(legalInputs(ambush, state, "p1").map((i) => i.action)).toEqual([
    "drink",
    "endure",
  ]);

  // Drinking sets the live data's damage to 0 before the strike resolves
  const drank = applyOrThrow(ambush, state, drink.by("p1"));
  expect(drank.vars.hp).toEqual({ p1: 10, p2: 10 });
  // Enduring takes the full 3
  const hurt = applyOrThrow(ambush, state, endure.by("p1"));
  expect(hurt.vars.hp).toEqual({ p1: 7, p2: 10 });
  // #endregion trap
  expect(actors(ambush, drank)).toEqual(["p2"]);
});

test("a game-wide ability without `who` binds to the flow's player; enters fires on create", () => {
  const token = entity<{ hot: boolean }>("token");
  const pile = zone("pile", { holds: token, perPlayer: true });
  const { rules, action, effect, ability, loop, turns, prompt, step } = define<{
    asked: string[];
  }>({ zones: [pile] }).withNodes(defaultNodes);
  const ping = effect<{ n: number }>("ping");
  const ok = action("ok", {
    execute: (tx, actor) => void tx.vars.asked.push(actor),
  });
  const answer = ability({
    on: ping,
    then: () => prompt({ label: "Ack" }, ok),
  });
  const burn = ability({
    of: token,
    in: pile,
    on: "enters",
    then: (t) => step((tx) => void tx.vars.asked.push(`burn ${t.owner(tx)}`)),
  });
  const game = rules({
    players: 2,
    setup: (tx) => void (tx.vars = { asked: [] }),
    abilities: [answer, burn],
    flow: loop(
      {},
      turns(
        {},
        prompt(
          action("go", {
            execute(tx, actor) {
              tx.create(token, { hot: true }, pile.of(actor));
              tx.cause(ping, { n: 1 });
            },
          }),
        ),
      ),
    ),
  });
  let s = init(game, { players, seed: "s" });
  s = applyOrThrow(game, s, game.action("go").by("p1"));
  expect(s.vars.asked).toEqual(["burn p1"]);
  expect(actors(game, s)).toEqual(["p1"]);
  s = applyOrThrow(game, s, ok.by("p1"));
  s = applyOrThrow(game, s, game.action("go").by("p2"));
  expect(actors(game, s)).toEqual(["p2"]);
});
