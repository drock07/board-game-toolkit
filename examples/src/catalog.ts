import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface CatalogEntry {
  slug: string;
  group: "Concepts" | "Examples";
  title: string;
  desc: string;
  tags: string[];
  /** The UI's file name in `src/games/<slug>/`. */
  component: string;
  Page: LazyExoticComponent<ComponentType>;
  /** Shown on the inspector's "How it works" tab. */
  notes: string[];
}

export const REPO = "https://github.com/drock07/board-game-toolkit";
export const sourceUrl = (path: string) =>
  `${REPO}/blob/main/examples/src/${path}`;

/** Each game's `game.ts`, as text, for the "How it works" tab. */
const specs = import.meta.glob<string>("./games/*/game.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});
export const specSource = (slug: string) =>
  specs[`./games/${slug}/game.ts`] ?? "";

export const catalog: CatalogEntry[] = [
  {
    slug: "sandbox",
    group: "Concepts",
    title: "Card Pool Sandbox",
    desc: "Zones, visibility and ops: draw, discard and shuffle a deck at a table that never closes.",
    tags: ["Zones", "Visibility", "Ops"],
    component: "Sandbox",
    Page: lazy(() => import("./games/sandbox/Sandbox")),
    notes: [
      "Cards are entities of the shared card type, living in zone handles: a hidden deck and a public hand and discard. Views key entities by ref and show a hidden card as only its ref and zone. Shuffling gives the deck's cards new refs, so it reveals nothing, and a drawn card shows its face only once it lands in the public hand.",
      "The whole flow is a loop around one labelled prompt, so the table never closes. Each action is a transaction of ops (moveTop, move, shuffle). Validation keeps an action out of the legal inputs when it can't apply, like drawing from an empty deck, and each op becomes an event the page plays back.",
    ],
  },
  {
    slug: "tic-tac-toe",
    group: "Examples",
    title: "Tic-Tac-Toe",
    desc: "Take turns until the board is decided. Shows turns from a random seat, an endless session loop, and a minimax bot.",
    tags: ["turns", "Bots", "Vars"],
    component: "TicTacToe",
    Page: lazy(() => import("./games/tic-tac-toe/TicTacToe")),
    notes: [
      'The board is nine cells in vars. A session loops forever: a step clears the board and draws a random starter, turns runs from that seat until the board is decided, a step records the result, and a prompt labelled "Play again" waits.',
      "The computer is a bot: a function from its legal inputs (and its view) to one of them. The host runs it when its seat may act, after a short delay, and the engine checks its input like anyone else's.",
    ],
  },
  {
    slug: "blackjack",
    group: "Examples",
    title: "Blackjack",
    desc: "One hand at a time against the dealer. Shows outcomes around play, a face-down hole card, and a branch when you go broke.",
    tags: ["outcomes", "faceUp", "branch"],
    component: "Blackjack",
    Page: lazy(() => import("./games/blackjack/Blackjack")),
    notes: [
      "The dealer's second card is dealt with moveTop(..., { faceUp: false }), so views hide it even though the dealer's zone is public. Flipping it at the dealer's turn or at settle produces a flipped event that reveals it.",
      "Play is wrapped in outcomes with two guards, natural and bust, checked on entry and after every transaction: a natural skips the player's turn, and hitting past 21 cancels play at once, so the dealer never draws. The player's turn is a turn node that holds the Hit or stand prompt open across hits; stand returns \"end\", and its until ends the turn on 21. After settling, a branch resets an empty bankroll and asks to play again, or asks to deal again.",
    ],
  },
  {
    slug: "roll-five",
    group: "Examples",
    title: "Roll Five",
    desc: "Thirteen rounds of rolling and holding five dice. Shows locals that reset each round and a decision that stays open.",
    tags: ["Locals", "Dice", "ends: false"],
    component: "RollFive",
    Page: lazy(() => import("./games/roll-five/RollFive")),
    notes: [
      "The dice live in the turn decision's locals, created fresh each time the node is entered, so nothing needs resetting between rounds.",
      "Roll and toggleHold don't end the decision; score does. The dice come from tx.random, the seeded RNG in state, so replays roll the same numbers.",
    ],
  },
  {
    slug: "dungeon-crawl",
    group: "Examples",
    title: "Dungeon Crawl",
    desc: "Explore a dungeon of monsters, treasure and traps. Shows subflows, raised outcomes and outermost-first guards.",
    tags: ["Subflows", "Outcomes", "Guards"],
    component: "DungeonCrawl",
    Page: lazy(() => import("./games/dungeon-crawl/DungeonCrawl")),
    notes: [
      "Combat and traps are subflows, used from the room branch; their node ids are prefixed, like combat.playerAttack.",
      "Fleeing raises the fled outcome with tx.exit, which the fight loop handles in its on map. The run seq's guards turn a dead player or a dead dragon into defeat or victory, wherever the flow happens to be.",
    ],
  },
  {
    slug: "crazy-eights",
    group: "Examples",
    title: "Crazy Eights",
    desc: "Shed your hand against two bots. Shows owner-only hands, a top-only discard pile, and choose for the wild color.",
    tags: ["Views", "choose", "Bots"],
    component: "CrazyEights",
    Page: lazy(() => import("./games/crazy-eights/CrazyEights")),
    notes: [
      "Hands are per-player zones with owner visibility: switch “Viewing as” to see another seat's view. The discard pile shows only its top card.",
      "Playing an eight runs the action's then flow: a choose prompt for the new color. Bots see only their own view, just like you.",
    ],
  },
  {
    slug: "tower-battler",
    group: "Examples",
    title: "TowerBattler",
    desc: "Deck-building combat against one enemy. Shows card effects resolved in one transaction, and exits checked mid-turn.",
    tags: ["Effects", "exits", "Custom events"],
    component: "TowerBattler",
    Page: lazy(() => import("./games/tower-battler/TowerBattler")),
    notes: [
      "Cards are entities whose props list their effects. Playing one resolves every effect in the same transaction, so the events play back in order: damage, block, draws.",
      "The rounds loop exits on enemyDead or playerDead, checked after every transaction, so the enemy can fall mid-turn. The enemy's attack emits a custom event the page uses to flash the damage.",
    ],
  },
  {
    slug: "sealed-bids",
    group: "Examples",
    title: "Sealed Bids",
    desc: "Everyone bids at once, in secret, on three lots. Shows parallel each and owner-only vars.",
    tags: ["Parallel each", "Hidden vars"],
    component: "SealedBids",
    Page: lazy(() => import("./games/sealed-bids/SealedBids")),
    notes: [
      "Bidding is an each over players with mode: parallel: every player gets a prompt at once, answered in any order. The round resolves once all are in.",
      "The bids var has owner visibility, so each view holds only the viewer's own bid. Switch “Viewing as” to check.",
    ],
  },
  {
    slug: "plus-two",
    group: "Examples",
    title: "Plus Two",
    desc: "+2 cards stack across players. Shows a trigger interrupting the turn and a race between responses.",
    tags: ["Triggers", "parallel race"],
    component: "PlusTwo",
    Page: lazy(() => import("./games/plus-two/PlusTwo")),
    notes: [
      "Moving a +2 from a hand to the discard fires the plusTwo trigger, which interrupts whatever played it, even another window, with a response window.",
      "The window is a parallel with join: race: the first answer wins, either a stack (which opens its own window) or the victim taking the penalty. The other branch is cancelled.",
    ],
  },
];

export const entryBySlug = (slug: string) =>
  catalog.find((e) => e.slug === slug);
