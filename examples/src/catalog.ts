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
    desc: "Thirteen rounds of rolling and holding five dice. Shows a turn that stays open across rolls, with per-action limits and counts the UI reads.",
    tags: ["turn", "Dice", "limits"],
    component: "RollFive",
    Page: lazy(() => import("./games/roll-five/RollFive")),
    notes: [
      'The dice and which are held live in vars; scoring a category clears them for the next turn. Each round is one turn node holding a single prompt open: limits caps roll at three, first makes rolling the only way to start, and score returns "end" to close the turn.',
      'The turn counts its own answers, so nothing in vars tracks rolls. The UI reads them with turnNode.shown(view), and a session loop clears the sheet and waits on a prompt labelled "Play again" after thirteen rounds.',
    ],
  },
  {
    slug: "dungeon-crawl",
    group: "Examples",
    title: "Dungeon Crawl",
    desc: "Explore a 5×5 dungeon of monsters, treasure and traps. Shows nested outcomes, an action that raises one, and reused flow pieces.",
    tags: ["outcomes", "branch", "Dice"],
    component: "DungeonCrawl",
    Page: lazy(() => import("./games/dungeon-crawl/DungeonCrawl")),
    notes: [
      "The run is wrapped in outcomes with two guards, defeat at zero hp and victory when the dragon falls, checked after every transaction outermost first, so dying mid-fight or mid-trap ends the run at once and the boss's killing blow counts as victory rather than the fight's own killed guard. Fleeing is an outcome the flee action raises by returning { exit: \"fled\" }.",
      "Combat, traps and treasure are plain JS constants composed into a branch, which is all a subflow is now. The fight's and trap's rolls live in small vars blocks set when the room starts and cleared when you leave it, and a trap is a turn that stays open through failed attempts until dismantling returns \"end\".",
    ],
  },
  {
    slug: "crazy-eights",
    group: "Examples",
    title: "Crazy Eights",
    desc: "Shed your hand against two bots. Shows owner-only hands, a discard pile where only the top card shows, and an outcome that asks for the wild color.",
    tags: ["Views", "Outcomes", "Bots"],
    component: "CrazyEights",
    Page: lazy(() => import("./games/crazy-eights/CrazyEights")),
    notes: [
      "Hands are per-player zones with owner visibility: switch “Viewing as” to see another seat's view. The discard zone is hidden, but each card is played onto it face up and the card underneath is flipped face down, so only the top card shows.",
      "Each player's turn is a prompt inside turns, wrapped in an outcomes node. Playing an eight returns { exit: \"wild\" }, and the outcome's then prompt asks the same player to call a color. Bots get the same legal inputs and view as you, so they see only their own hand.",
    ],
  },
  {
    slug: "tower-battler",
    group: "Examples",
    title: "TowerBattler",
    desc: "Deck-building combat against one enemy, where cards resolve their effects in one transaction and the fight ends the moment someone falls.",
    tags: ["outcomes", "turn", "Effects"],
    component: "TowerBattler",
    Page: lazy(() => import("./games/tower-battler/TowerBattler")),
    notes: [
      'Your turn is a turn node: it stays open while you play cards, each resolving all its effects in one transaction so damage, block and draws play back in order, until End turn returns "end".',
      "The fight sits inside outcomes whose won and lost guards are checked after every transaction, so the enemy can fall mid-turn and never attack. The enemy's attack is an effect whose resolve applies the damage, and the page flashes the hit with useGameEffect as it plays back.",
    ],
  },
  {
    slug: "sealed-bids",
    group: "Examples",
    title: "Sealed Bids",
    desc: "Everyone bids at once, in secret, on three lots. Shows everyone prompts, bids hidden in each player's own zone, and an effect the page reacts to.",
    tags: ["Simultaneous", "Hidden zones", "Effects"],
    component: "SealedBids",
    Page: lazy(() => import("./games/sealed-bids/SealedBids")),
    notes: [
      "Bidding is an everyone node: each player gets their own prompt on their own fiber, they answer in any order, and the round resolves once all are in. A bid is an entity in the bidder's own sealed zone, which has owner visibility, so other views hold only a hidden placeholder. Switch “Viewing as” to check.",
      "Resolving a lot causes a sold effect with the winner, item and price. The page listens with useGameEffect and pauses playback so each result stays on screen for a moment.",
    ],
  },
  {
    slug: "plus-two",
    group: "Examples",
    title: "Plus Two",
    desc: "+2 cards stack across players: anyone may pass the growing penalty on, or the victim takes it.",
    tags: ["anyone", "loop", "Hidden hands"],
    component: "PlusTwo",
    Page: lazy(() => import("./games/plus-two/PlusTwo")),
    notes: [
      "Each turn is a prompt to play, draw or pass, followed by the penalty window. The window is a loop that runs while a penalty is pending, so a stack simply goes round again with a bigger penalty and the turn continues only once someone takes it.",
      "The window itself is an anyone node: every player except the one who played the newest +2 may answer, and the first answer wins, either stacking another +2 or, for the victim alone, drawing the penalty. Hands are per-player zones with owner visibility, so switch “Viewing as” to see another seat's view.",
    ],
  },
];

export const entryBySlug = (slug: string) =>
  catalog.find((e) => e.slug === slug);
