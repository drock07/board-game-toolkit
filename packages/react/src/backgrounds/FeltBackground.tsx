import { useId } from "react";

export interface FeltBackgroundProps {
  className?: string;
}

/**
 * Renders a green casino felt texture as a full-bleed SVG background.
 *
 * Usage: place inside a `relative` container, then layer content on top
 * with `relative z-10`.
 */
export function FeltBackground({ className }: FeltBackgroundProps) {
  const id = useId();
  const filterId = `${id}-felt-texture`;
  const vignetteId = `${id}-felt-vignette`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={["absolute inset-0 size-full", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={filterId}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          {/*
           * Asymmetric x/y baseFrequency creates a subtle directional fiber
           * look — fibers run slightly more along one axis, like real woven felt.
           */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65 0.85"
            numOctaves="4"
            seed="5"
            stitchTiles="stitch"
            result="noise"
          />
          {/* Collapse to grayscale so only luminance varies, not hue */}
          <feColorMatrix
            type="saturate"
            values="0"
            in="noise"
            result="grayNoise"
          />
          {/* Boost contrast so individual fibers read clearly */}
          <feComponentTransfer in="grayNoise" result="sharpNoise">
            <feFuncR type="linear" slope="1.5" intercept="-0.25" />
            <feFuncG type="linear" slope="1.5" intercept="-0.25" />
            <feFuncB type="linear" slope="1.5" intercept="-0.25" />
          </feComponentTransfer>
          {/* Casino green base */}
          <feFlood floodColor="#236b40" result="greenBase" />
          {/*
           * soft-light blend: preserves the green hue while using the noise
           * as a light/dark modulator — values near 0.5 leave the base
           * unchanged; lighter noise lightens, darker noise darkens.
           */}
          <feBlend in="greenBase" in2="sharpNoise" mode="soft-light" />
        </filter>

        {/* Radial vignette: edges are dimmer, center is brighter — classic table look */}
        <radialGradient id={vignetteId} cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
      </defs>

      {/* Felt base with fiber texture */}
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      {/* Vignette overlay */}
      <rect width="100%" height="100%" fill={`url(#${vignetteId})`} />
    </svg>
  );
}
