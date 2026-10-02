// Event playback with useGameEvent, for the "Animating events" guide.
import { randomBot } from "@drock07/board-game-toolkit-engine";
import {
  GameHost,
  useGame,
  useGameEvent,
} from "@drock07/board-game-toolkit-react";
import { useState } from "react";
import { towerBattler } from "../games/tower-battler";

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// #region table
export function Table() {
  const g = useGame(towerBattler, { players: ["p1"] });
  const [flash, setFlash] = useState<number | null>(null);

  // Each card move gets 200ms to animate before the next event plays
  useGameEvent(g, "moved", () => wait(200));

  // A custom event from tx.emit: show the damage, then clear it
  useGameEvent(g, "custom", async (event) => {
    if (event.name !== "enemyAttacked") return;
    const { damage } = event.payload as { damage: number };
    setFlash(damage);
    await wait(600);
    setFlash(null);
  });

  return (
    <div>
      <p>Your HP: {g.view.vars.player?.hp}</p>
      {flash !== null && <p className="damage">−{flash}</p>}
      {/* While events play back, `legal` is empty, so inputs wait too */}
      {g.legal.map((input) => (
        <button key={JSON.stringify(input)} onClick={() => g.submit(input)}>
          {"action" in input ? input.action : "Continue"}
        </button>
      ))}
    </div>
  );
}
// #endregion table

// #region host
// Outside React: the same host, framework-free
export function startHeadless() {
  const host = new GameHost(towerBattler, {
    players: [{ id: "p1", controller: randomBot() }],
    botDelay: 0,
  });
  host.on("moved", () => wait(50));
  host.subscribe(() => {
    const { view, playing } = host.getSnapshot();
    if (!playing) console.log("HP", view.vars.player?.hp);
  });
  host.start();
  return () => host.stop();
}
// #endregion host
