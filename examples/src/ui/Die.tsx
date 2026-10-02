import clsx from "clsx";

const L = 26.667;
const M = 50;
const H = 73.333;
const PIPS: Record<number, [number, number][]> = {
  1: [[M, M]],
  2: [
    [L, H],
    [H, L],
  ],
  3: [
    [L, H],
    [M, M],
    [H, L],
  ],
  4: [
    [L, L],
    [L, H],
    [H, L],
    [H, H],
  ],
  5: [
    [L, L],
    [L, H],
    [M, M],
    [H, L],
    [H, H],
  ],
  6: [
    [L, L],
    [L, M],
    [L, H],
    [H, L],
    [H, M],
    [H, H],
  ],
};

/** A die face. `value` 0 draws a blank die. Dice stay white in dark mode. */
export function Die({
  value,
  size = 88,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pip = size / 6;
  return (
    <div
      role="img"
      aria-label={value ? `Die showing ${value}` : "Unrolled die"}
      className={clsx("relative shrink-0 bg-white", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 10,
        border: `${Math.max(1, size / 50)}px solid #5b5b5b`,
      }}
    >
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-black"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: pip,
            height: pip,
            margin: `${-pip / 2}px 0 0 ${-pip / 2}px`,
          }}
        />
      ))}
    </div>
  );
}
