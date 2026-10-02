import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/** The stage's action button. One primary action per prompt. */
export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        "h-11 min-w-30 rounded-lg border px-5 text-[15px] font-semibold transition-colors",
        "disabled:cursor-default disabled:border-line disabled:bg-well disabled:text-faint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variant === "primary"
          ? "border-primary bg-primary text-on-primary enabled:hover:opacity-90"
          : "border-line-strong bg-panel text-ink enabled:hover:bg-well",
        className,
      )}
    />
  );
}

/** The compact square variant, for option sets like bets or colors. */
export function OptionButton({
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={clsx(
        "flex h-11 min-w-14 items-center justify-center gap-2 rounded-lg border px-3 font-mono text-sm font-medium transition-colors",
        "disabled:cursor-default disabled:border-line disabled:bg-well disabled:text-faint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-line-strong bg-panel text-ink enabled:hover:bg-well",
        className,
      )}
    />
  );
}

/** A HUD stat: an uppercase label over a mono value. */
export function Stat({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow">{label}</span>
      <span
        className={clsx(
          "flex items-center gap-2 font-mono text-[22px] font-medium",
          className,
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** A labelled bar, e.g. hit points. */
export function Meter({
  label,
  value,
  max,
  tone = "ink",
  className,
}: {
  label: string;
  value: number;
  max: number;
  tone?: "ink" | "good" | "bad" | "accent";
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <div className="flex justify-between eyebrow">
        <span>{label}</span>
        <span className="text-ink">
          {value}/{max}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded bg-line"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={clsx(
            "h-full transition-[width] duration-300",
            {
              ink: "bg-ink",
              good: "bg-good",
              bad: "bg-bad",
              accent: "bg-accent",
            }[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export type BannerTone = "win" | "lose" | "push";

/** A result line: a short tag and a message. */
export function Banner({
  tone,
  tag,
  children,
}: {
  tone: BannerTone;
  tag: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[10px] border border-line bg-panel px-4 py-3"
    >
      <span
        className={clsx(
          "rounded px-2 py-0.5 font-mono text-xs font-semibold",
          tone === "win" && "bg-good-soft text-good",
          tone === "lose" && "bg-bad-soft text-bad",
          tone === "push" && "bg-well text-muted",
        )}
      >
        {tag}
      </span>
      <span className="text-[15px] font-semibold">{children}</span>
    </div>
  );
}

/** A card centered over the stage, for game-over and between-hand moments. */
export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-stage/60 p-4 backdrop-blur-[2px]">
      <div className="flex w-85 max-w-full flex-col gap-4 rounded-xl border border-line bg-panel p-6 shadow-[0_12px_32px_rgba(24,24,27,.08)]">
        {children}
      </div>
    </div>
  );
}

/** A dashed hint where the actions would go, when input is on the board. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-11 items-center rounded-lg border border-dashed border-line-strong px-4 text-sm text-muted">
      {children}
    </div>
  );
}

/** A white card with an eyebrow header, for game-specific side panels. */
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "overflow-hidden rounded-[10px] border border-line bg-panel",
        className,
      )}
    >
      <h3 className="border-b border-line px-3.5 py-2.5 eyebrow">{title}</h3>
      <div className="flex flex-col gap-3.5 p-3.5">{children}</div>
    </section>
  );
}

export const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
