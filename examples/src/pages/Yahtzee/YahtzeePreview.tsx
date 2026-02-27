export default function YahtzeePreview() {
  return (
    <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true">
      {/* Five dice in a scattered arrangement */}
      {[
        { x: 10, y: 30, pips: 5 },
        { x: 45, y: 10, pips: 5 },
        { x: 80, y: 25, pips: 5 },
        { x: 25, y: 70, pips: 5 },
        { x: 65, y: 65, pips: 5 },
      ].map(({ x, y, pips }, i) => (
        <g key={i}>
          <rect
            x={x}
            y={y}
            width="30"
            height="30"
            rx="4"
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.3"
          />
          {/* Center pip */}
          {[1, 3, 5].includes(pips) && (
            <circle
              cx={x + 15}
              cy={y + 15}
              r="2.5"
              fill="black"
              opacity="0.4"
            />
          )}
          {/* Corner pips for 5 */}
          <circle cx={x + 8} cy={y + 8} r="2.5" fill="black" opacity="0.4" />
          <circle cx={x + 22} cy={y + 8} r="2.5" fill="black" opacity="0.4" />
          <circle cx={x + 8} cy={y + 22} r="2.5" fill="black" opacity="0.4" />
          <circle cx={x + 22} cy={y + 22} r="2.5" fill="black" opacity="0.4" />
        </g>
      ))}
    </svg>
  );
}
