import { Dialog, DialogPanel, Radio, RadioGroup } from "@headlessui/react";
import {
  Bars3Icon,
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { catalog, REPO } from "../catalog";
import { useTheme, type Theme } from "./theme";

const NPM =
  "https://github.com/drock07/board-game-toolkit/pkgs/npm/board-game-toolkit-engine";

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(
          "flex rounded-md px-2 py-[7px] text-sm",
          isActive
            ? "bg-nav-active font-medium text-ink"
            : "text-ink-2 hover:bg-nav-active/60",
        )
      }
    >
      {children}
    </NavLink>
  );
}

const THEMES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "system", label: "System", Icon: ComputerDesktopIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <RadioGroup
      value={theme}
      onChange={setTheme}
      aria-label="Theme"
      className="flex rounded-lg border border-line bg-panel p-0.5"
    >
      {THEMES.map(({ value, label, Icon }) => (
        <Radio
          key={value}
          value={value}
          aria-label={label}
          title={label}
          className="flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-subtle hover:text-ink focus:outline-none data-checked:bg-nav-active data-checked:text-ink data-focus:outline-2 data-focus:outline-accent"
        >
          <Icon className="size-4" aria-hidden />
        </Radio>
      ))}
    </RadioGroup>
  );
}

function Sidebar() {
  const groups = ["Concepts", "Examples"] as const;
  return (
    <div className="flex h-full flex-col gap-7 px-4 py-6">
      <div className="flex flex-col gap-1.5 px-2">
        <div className="text-base font-bold tracking-[-0.01em]">
          Board Game Toolkit
        </div>
        <div className="font-mono text-xs text-subtle">examples</div>
      </div>
      <nav aria-label="Site" className="flex flex-col gap-7 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          <NavItem to="/">Overview</NavItem>
        </div>
        {groups.map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            <h2 className="px-2 pb-1.5 eyebrow">{group}</h2>
            {catalog
              .filter((e) => e.group === group)
              .map((e) => (
                <NavItem key={e.slug} to={`/${e.slug}`}>
                  {e.title}
                </NavItem>
              ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex flex-col gap-0.5">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="flex px-2 py-[7px] text-sm text-ink-2 hover:text-ink"
          >
            GitHub ↗
          </a>
          <a
            href={NPM}
            target="_blank"
            rel="noreferrer"
            className="flex px-2 py-[7px] text-sm text-ink-2 hover:text-ink"
          >
            Package ↗
          </a>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Close the drawer on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  return (
    <div className="flex h-full">
      <aside className="hidden w-65 shrink-0 border-r border-line bg-chrome lg:block">
        <Sidebar />
      </aside>
      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <div className="fixed inset-0 bg-black/30" aria-hidden />
        <DialogPanel className="fixed inset-y-0 left-0 w-72 border-r border-line bg-chrome">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-5 right-3 rounded-md p-1 text-subtle hover:text-ink"
            aria-label="Close menu"
          >
            <XMarkIcon className="size-5" />
          </button>
          <Sidebar />
        </DialogPanel>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-chrome px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-1 text-ink-2 hover:text-ink"
            aria-label="Open menu"
          >
            <Bars3Icon className="size-5" />
          </button>
          <span className="text-sm font-bold">Board Game Toolkit</span>
        </div>
        <div className="min-h-0 flex-1">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
