// The server guide's room, with the test standing in for the clients.
import {
  randomBot,
  replay,
  viewEntities,
  type InputOf,
  type View,
} from "@drock07/board-game-toolkit-engine";
import { expect, test } from "vitest";
import { hand, highCard, playCard, type Vars } from "./highCard";
import { Room, type ServerMessage } from "./server";

type Message = ServerMessage<Vars, InputOf<typeof playCard>>;

/** A client: the view it was sent, kept up to date by replaying its events. */
class Client {
  view!: View<Vars>;
  legal: InputOf<typeof playCard>[] = [];
  rejected: string[] = [];
  receive(m: Message) {
    // #region client
    if (m.type === "welcome") this.view = m.view;
    if (m.type === "update") this.view = replay(this.view, m.events);
    if (m.type !== "rejected") this.legal = m.legal;
    // #endregion client
    if (m.type === "rejected") this.rejected.push(m.reason);
  }
}

const players = ["ann", "bob"];

function connect(clients: Record<string, Client>) {
  return (to: string, m: Message) => clients[to]?.receive(m);
}

test("each client keeps its own view, by replaying its own events", () => {
  const clients = { ann: new Client(), bob: new Client() };
  const room = new Room(highCard, players, "s1", connect(clients));
  room.join("ann");
  room.join("bob");

  // ann plays her card; bob may then play his
  room.receive("ann", clients.ann.legal[0]!);
  expect(clients.bob.legal.map((i) => i.action)).toEqual(["playCard"]);
  room.receive("bob", clients.bob.legal[0]!);

  // A replayed view matches a fresh one: rejoin and compare
  const replayed = clients.bob.view;
  room.join("bob");
  expect(replayed).toEqual(clients.bob.view);

  // bob never sees ann's hand
  for (const e of viewEntities(clients.bob.view, hand.of("ann")))
    expect("hidden" in e).toBe(true);
});

test("an input for someone else's seat is refused", () => {
  const clients = { ann: new Client(), bob: new Client() };
  const room = new Room(highCard, players, "s1", connect(clients));
  room.join("ann");
  room.join("bob");
  room.receive("bob", clients.ann.legal[0]!);
  expect(clients.bob.rejected).toEqual(["Not your seat"]);
  expect(room.inputs).toEqual([]);

  room.receive("bob", playCard.by("bob", { id: "card#1" }));
  expect(clients.bob.rejected[1]).toBe("It is ann's turn, not bob's");
});

test("a bot seat answers on the server; the log rebuilds the room", () => {
  const clients = { ann: new Client() };
  const room = new Room(highCard, players, "s2", connect(clients), {
    bob: randomBot("bob"),
  });
  room.join("ann");
  room.receive("ann", clients.ann.legal[0]!);
  // bob answered at once, so it's ann's turn again
  expect(room.inputs.map((i) => i.player)).toEqual(["ann", "bob"]);
  expect(clients.ann.legal.length).toBeGreaterThan(0);

  const copy = { ann: new Client() };
  const restored = Room.restore(
    highCard,
    { players, seed: "s2", inputs: room.inputs },
    connect(copy),
  );
  restored.join("ann");
  expect(copy.ann.view).toEqual(clients.ann.view);
});
