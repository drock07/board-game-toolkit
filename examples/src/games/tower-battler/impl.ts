import type {
  EntityId,
  GameImpl,
  Tx,
  TypesFor,
} from "@drock07/board-game-toolkit-engine";
import type { spec } from "./spec";

export type Effect =
  | { type: "dealDamage"; amount: number }
  | { type: "gainBlock"; amount: number }
  | { type: "draw"; count: number };

export interface Card {
  name: string;
  cost: number;
  description: string;
  effects: Effect[];
}

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

export type Types = TypesFor<
  typeof spec,
  { vars: Vars; entities: { card: Card } }
>;

export type PlayArgs = { card: EntityId };

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
export function drawCards(tx: Tx<Types>, count: number): void {
  for (let i = 0; i < count; i++) {
    if (tx.state.zones.draw.items.length === 0) {
      if (tx.state.zones.discard.items.length === 0) return;
      tx.move(tx.state.zones.discard.items, "draw");
      tx.shuffle("draw");
    }
    tx.moveTop("draw", "hand");
  }
}

function resolve(tx: Tx<Types>, effect: Effect): void {
  switch (effect.type) {
    case "dealDamage":
      tx.vars.enemy.hp = Math.max(0, tx.vars.enemy.hp - effect.amount);
      return;
    case "gainBlock":
      tx.vars.player.block += effect.amount;
      return;
    case "draw":
      drawCards(tx, effect.count);
      return;
  }
}

export const impl = {
  setup(tx) {
    for (const card of DECK) tx.create("card", card, "draw");
    tx.vars = freshVars();
  },
  conditions: {
    enemyDead: (s) => s.vars.enemy.hp <= 0,
    playerDead: (s) => s.vars.player.hp <= 0,
  },
  steps: {
    buildDeckAndDraw(tx) {
      const { hand, discard } = tx.state.zones;
      tx.move([...hand.items, ...discard.items], "draw");
      tx.shuffle("draw");
      tx.vars = freshVars();
      drawCards(tx, 5);
    },
    enemyAttack(tx) {
      tx.move(tx.state.zones.hand.items, "discard");
      const { player, enemy } = tx.vars;
      const blocked = Math.min(enemy.intent, player.block);
      player.hp = Math.max(0, player.hp - (enemy.intent - blocked));
      player.block = 0;
      tx.emit("enemyAttacked", { damage: enemy.intent - blocked, blocked });
    },
    startNextTurn(tx) {
      tx.vars.turn++;
      tx.vars.player.energy = tx.vars.player.maxEnergy;
      tx.vars.player.block = 0;
      tx.vars.enemy.intent = intentFor(tx.vars.turn);
      drawCards(tx, 5);
    },
    announceResult(tx) {
      tx.vars.result = tx.vars.enemy.hp <= 0 ? "win" : "lose";
    },
  },
  actions: {
    playCard: {
      enumerate: (s): PlayArgs[] =>
        s.zone("hand").items.map((card) => ({ card })),
      validate(s, args: PlayArgs) {
        if (!s.zone("hand").items.includes(args.card))
          return "That card isn't in your hand";
        const card = s.entity(args.card);
        if (card.props.cost > s.vars.player.energy) return "Not enough energy";
        return true;
      },
      execute(tx, args: PlayArgs) {
        const card = tx.state.entities[args.card]!.props;
        tx.move(args.card, "discard");
        tx.vars.player.energy -= card.cost;
        for (const effect of card.effects) resolve(tx, effect);
      },
    },
    endTurn: { execute: () => {} },
  },
} satisfies GameImpl<Types>;
