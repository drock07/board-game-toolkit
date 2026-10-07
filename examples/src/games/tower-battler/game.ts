import {
  defaultNodes,
  define,
  entity,
  zone,
  type Tx,
} from "@drock07/board-game-toolkit-engine";

// #region card
/** What a card does when played, in order. */
export type CardEffect =
  | { type: "dealDamage"; amount: number }
  | { type: "gainBlock"; amount: number }
  | { type: "draw"; count: number };

export interface Card {
  name: string;
  cost: number;
  description: string;
  effects: CardEffect[];
}
// #endregion card

// #region types
export interface Vars {
  player: {
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    maxEnergy: number;
  };
  enemy: { hp: number; maxHp: number; intent: number };
  turn: number;
  result: "win" | "lose" | null;
}

/** An enemy attack: the damage that got through, and how much block stopped. */
export interface Hit {
  damage: number;
  blocked: number;
}

// Battle cards, not playing cards, so this game has its own type
export const card = entity<Card>("card");
export const drawPile = zone("draw", { holds: card, visibility: "hidden" });
export const hand = zone("hand", { holds: card });
export const discard = zone("discard", { holds: card });
// #endregion types

const { rules, action, effect, loop, seq, step, turn, outcomes, prompt } =
  define<Vars>({ zones: [drawPile, hand, discard] }).withNodes(defaultNodes);

const STRIKE: Card = {
  name: "Strike",
  cost: 1,
  description: "Deal 6 damage",
  effects: [{ type: "dealDamage", amount: 6 }],
};
const DEFEND: Card = {
  name: "Defend",
  cost: 1,
  description: "Gain 5 block",
  effects: [{ type: "gainBlock", amount: 5 }],
};
const BASH: Card = {
  name: "Bash",
  cost: 2,
  description: "Deal 8 damage, gain 2 block",
  effects: [
    { type: "dealDamage", amount: 8 },
    { type: "gainBlock", amount: 2 },
  ],
};
const SPRINT: Card = {
  name: "Sprint",
  cost: 1,
  description: "Draw 2 cards",
  effects: [{ type: "draw", count: 2 }],
};

export const DECK: Card[] = [
  ...Array<Card>(5).fill(STRIKE),
  ...Array<Card>(4).fill(DEFEND),
  ...Array<Card>(2).fill(BASH),
  SPRINT,
];

export const TURN_LABEL = "Play cards or end your turn";

/** The enemy alternates light and heavy attacks. */
export const intentFor = (turn: number) => (turn % 3 === 0 ? 14 : 8);

const freshVars = (): Vars => ({
  player: { hp: 50, maxHp: 50, block: 0, energy: 3, maxEnergy: 3 },
  enemy: { hp: 40, maxHp: 40, intent: intentFor(1) },
  turn: 1,
  result: null,
});

/**
 * Draws `count` cards, shuffling the discard pile back in whenever the draw
 * pile runs out. Stops early only when both are empty.
 */
export function drawCards(tx: Tx<Vars>, count: number): void {
  for (let i = 0; i < count; i++) {
    if (tx.count(drawPile) === 0) {
      if (tx.count(discard) === 0) return;
      tx.move(
        tx.entities(discard).map((e) => e.id),
        drawPile,
      );
      tx.shuffle(drawPile);
    }
    tx.moveTop(drawPile, hand);
  }
}

function resolveCard(tx: Tx<Vars>, e: CardEffect): void {
  switch (e.type) {
    case "dealDamage":
      tx.vars.enemy.hp = Math.max(0, tx.vars.enemy.hp - e.amount);
      return;
    case "gainBlock":
      tx.vars.player.block += e.amount;
      return;
    case "draw":
      drawCards(tx, e.count);
      return;
  }
}

// #region enemyAttack
/** The enemy's attack lands: the UI shows the hit as it plays back. */
export const enemyAttack = effect("enemyAttack", {
  resolve: (tx, hit: Hit) => {
    const { player } = tx.vars;
    player.hp = Math.max(0, player.hp - hit.damage);
    player.block = 0;
  },
});
// #endregion enemyAttack

// #region playCard
export const playCard = action("playCard", {
  enumerate: (s) => s.entities(hand).map((e) => ({ card: e.id })),
  validate(s, { card: id }) {
    const played = s.entities(hand).find((e) => e.id === id);
    if (!played) return "That card isn't in your hand";
    if (played.props.cost > s.vars.player.energy) return "Not enough energy";
    return true;
  },
  // The turn stays open: play as many cards as energy allows
  execute(tx, { card: id }) {
    const played = tx.entities(hand).find((e) => e.id === id)!.props;
    tx.move(id, discard);
    tx.vars.player.energy -= played.cost;
    for (const e of played.effects) resolveCard(tx, e);
  },
});
// #endregion playCard

export const endTurn = action("endTurn", { execute: () => "end" });
export const again = action("again", { execute: () => {} });

// #region rules
export const towerBattler = rules({
  players: 1,
  setup(tx) {
    for (const c of DECK) tx.create(card, c, drawPile);
    tx.vars = freshVars();
  },
  // Matches repeat forever: rebuild the deck, fight, record, wait
  flow: loop(
    {},
    seq(
      step((tx) => {
        const out = [...tx.entities(hand), ...tx.entities(discard)];
        if (out.length)
          tx.move(
            out.map((e) => e.id),
            drawPile,
          );
        tx.shuffle(drawPile);
        tx.vars = freshVars();
        drawCards(tx, 5);
      }),
      // #region fight
      // Checked after every transaction, so the enemy can fall mid-turn
      outcomes(
        {
          won: {
            when: (s) => s.vars.enemy.hp <= 0,
            then: step((tx) => void (tx.vars.result = "win")),
          },
          lost: {
            when: (s) => s.vars.player.hp <= 0,
            then: step((tx) => void (tx.vars.result = "lose")),
          },
        },
        loop(
          {},
          seq(
            turn({ label: TURN_LABEL }, playCard, endTurn),
            step((tx) => {
              const held = tx.entities(hand).map((e) => e.id);
              if (held.length) tx.move(held, discard);
              const { player, enemy } = tx.vars;
              const blocked = Math.min(enemy.intent, player.block);
              tx.cause(enemyAttack, {
                damage: enemy.intent - blocked,
                blocked,
              });
            }),
            step((tx) => {
              tx.vars.turn++;
              tx.vars.player.energy = tx.vars.player.maxEnergy;
              tx.vars.player.block = 0;
              tx.vars.enemy.intent = intentFor(tx.vars.turn);
              drawCards(tx, 5);
            }),
          ),
        ),
      ),
      // #endregion fight
      prompt({ label: "Play again" }, again),
    ),
  ),
});
// #endregion rules
