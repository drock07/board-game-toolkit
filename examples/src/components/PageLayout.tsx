import { FeltBackground } from "@drock07/board-game-toolkit-react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface PageLayoutProps {
  title?: string;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomCenter?: ReactNode;
  bottomRight?: ReactNode;
  children: ReactNode;
}

export function PageLayout({
  title,
  children,
  topRight,
  bottomLeft,
  bottomCenter,
  bottomRight,
}: PageLayoutProps) {
  return (
    <div className="relative size-full overflow-hidden">
      <FeltBackground />
      <div className="absolute top-0 left-0 z-20 flex gap-2 p-4">
        {title && (
          <GlassIconButton
            as={Link}
            to="/"
            aria-label="Back to examples"
            icon={ArrowLeftIcon}
          />
        )}
        <GlassContainer>
          <div>
            <span className="text-lg font-semibold">Board Game Toolkit</span>

            {title && (
              <span className="ml-2 text-sm font-medium text-white/80">
                {title}
              </span>
            )}
          </div>
        </GlassContainer>
      </div>

      {topRight && (
        <div className="absolute top-0 right-0 z-20 flex items-center gap-2 p-4">
          {topRight}
        </div>
      )}

      {bottomLeft && (
        <div className="absolute bottom-0 left-0 z-20 flex items-center gap-2 p-4">
          {bottomLeft}
        </div>
      )}

      {bottomCenter && (
        <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 p-4">
          {bottomCenter}
        </div>
      )}

      {bottomRight && (
        <div className="absolute right-0 bottom-0 z-20 flex items-center gap-2 p-4">
          {bottomRight}
        </div>
      )}

      <main className="relative z-10 size-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export function GlassContainer({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex h-12 items-center px-4 text-white",
        "rounded-4xl border border-white/20 bg-white/10 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl ring-inset",
        className,
      )}
    >
      {children}
    </div>
  );
}

type GlassIconButtonProps<T extends React.ElementType = "button"> = {
  as?: T;
  icon: React.FC<{ className?: string }>;
};
export function GlassIconButton<T extends React.ElementType = "button">({
  icon: Icon,
  ...props
}: GlassIconButtonProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof GlassIconButtonProps<T>>) {
  return (
    <GlassButton {...(props as GlassButtonProps)}>
      <Icon className="size-6" />
    </GlassButton>
  );
}

type GlassButtonProps<T extends React.ElementType = "button"> = {
  as?: T;
  circle?: boolean;
};
export function GlassButton<T extends React.ElementType = "button">({
  as: Tag = "button" as T,
  circle = false,
  ...props
}: GlassButtonProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof GlassButtonProps<T>>) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      {...props}
      className={clsx(
        "flex cursor-pointer items-center justify-center text-white/40 transition hover:text-white",
        "rounded-full border border-white/20 bg-white/10 shadow-xl ring-1 ring-white/10 backdrop-blur-2xl ring-inset hover:bg-white/20",
        "disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white/10 disabled:hover:text-white/40",
        {
          "size-12": circle,
          "px-4 py-3": !circle,
        },
      )}
    />
  );
}

function SafeInset() {
  return <div className="h-20" />;
}

PageLayout.SafeInset = SafeInset;

export default PageLayout;
