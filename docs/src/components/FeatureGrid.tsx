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
    title: "Flow as data",
    body: "Phases, rounds, turns and decisions are a JSON spec. Save it, diff it, draw it, or load it from a file.",
    link: "concepts/flow/",
    linkText: "How flow works",
    Icon: Square3Stack3DIcon,
  },
  {
    title: "Hidden information",
    body: "Zones and vars declare who sees what. Each player's view hides other hands, and hidden cards can't be tracked through a shuffle.",
    link: "examples/crazy-eights/",
    linkText: "Crazy Eights",
    Icon: EyeSlashIcon,
  },
  {
    title: "Simultaneous turns",
    body: "Run a decision for every player at once with a parallel each, and resolve the round when all are in.",
    link: "examples/sealed-bids/",
    linkText: "Sealed Bids",
    Icon: UsersIcon,
  },
  {
    title: "Interrupts and reactions",
    body: "Triggers watch for events and interrupt the flow, so a card can open a response window mid-turn.",
    link: "examples/plus-two/",
    linkText: "Plus Two",
    Icon: BoltIcon,
  },
  {
    title: "Bots",
    body: "A bot is a function from its own view to an input. The host paces it, and the engine checks its moves like anyone else's.",
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
    body: "The spec names its rules; the impl provides them. A missing or unused rule is a compile error, not a runtime surprise.",
    link: "concepts/spec-and-impl/",
    linkText: "Spec and impl",
    Icon: CheckBadgeIcon,
  },
  {
    title: "Fuzz testing",
    body: "fuzz plays thousands of random legal games and checks state invariants, replays and that no view leaks a hidden card.",
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
