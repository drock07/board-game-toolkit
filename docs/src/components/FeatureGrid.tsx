import {
  ArrowPathIcon,
  BoltIcon,
  BugAntIcon,
  CheckBadgeIcon,
  CpuChipIcon,
  EyeSlashIcon,
  FilmIcon,
  Square3Stack3DIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import { href } from "../lib/links";

interface Feature {
  title: string;
  body: string;
  link: string;
  /** What the link shows, e.g. an example's name. */
  linkText: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const FEATURES: Feature[] = [
  {
    title: "Flow you can see",
    body: "Rounds, turns and choices are a tree of nodes the engine runs for you. Its position is part of the state, so a save mid-turn resumes exactly, and tools can draw it.",
    link: "concepts/flow/",
    linkText: "How flow works",
    Icon: Square3Stack3DIcon,
  },
  {
    title: "Hidden information",
    body: "Zones declare who sees what. Each player's view hides other hands, and hidden cards can't be tracked through a shuffle.",
    link: "examples/crazy-eights/",
    linkText: "Crazy Eights",
    Icon: EyeSlashIcon,
  },
  {
    title: "Simultaneous turns",
    body: "Run a turn for every player at once with simultaneous, each on their own fiber, and resolve the round when all are in.",
    link: "examples/sealed-bids/",
    linkText: "Sealed Bids",
    Icon: UsersIcon,
  },
  {
    title: "Effects and abilities",
    body: "Effects happen in phases, and abilities on cards react before or after, so a Shield can block an attack mid-turn and each card's rule lives on the card.",
    link: "concepts/effects/",
    linkText: "Effects and abilities",
    Icon: BoltIcon,
  },
  {
    title: "Bots",
    body: "A bot picks from its legal inputs, seeing only its own view. The host paces it, and the engine checks its moves like anyone else's.",
    link: "guides/bots/",
    linkText: "Writing a bot",
    Icon: CpuChipIcon,
  },
  {
    title: "Deterministic replays",
    body: "The seeded RNG lives in state, so a seed and a list of inputs rebuild any game exactly, for saves, undo and bug reports.",
    link: "concepts/determinism/",
    linkText: "Determinism",
    Icon: ArrowPathIcon,
  },
  {
    title: "Event playback",
    body: "Every change is an event. The React host plays them back one at a time and waits for your animations.",
    link: "guides/animating-events/",
    linkText: "Animating events",
    Icon: FilmIcon,
  },
  {
    title: "Type-checked rules",
    body: "Entity types, zones, actions and effects are typed handles. A card's props, an action's args and an effect's data are checked everywhere you use them.",
    link: "concepts/model/",
    linkText: "The model",
    Icon: CheckBadgeIcon,
  },
  {
    title: "Fuzz testing",
    body: "fuzz plays thousands of random legal games, and checks every move is legal, every event replays exactly, and no view leaks a hidden card.",
    link: "guides/testing/",
    linkText: "Testing your game",
    Icon: BugAntIcon,
  },
];

/** The landing page's feature cards, each linking to where it's explained. */
export default function FeatureGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ title, body, link, linkText, Icon }) => (
        <li
          key={title}
          className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-panel p-5"
        >
          <Icon className="size-6 text-accent" aria-hidden />
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="text-sm/relaxed text-pretty text-muted">{body}</p>
          <a
            href={href(link)}
            className="mt-auto text-sm font-medium text-accent hover:text-accent-hover"
          >
            {linkText} →
          </a>
        </li>
      ))}
    </ul>
  );
}
