export default function DungeonCrawlPreview() {
  return (
    <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true">
      {/* 4x4 dungeon grid */}
      {Array.from({ length: 16 }).map((_, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 10 + col * 25;
        const y = 10 + row * 25;
        return (
          <rect key={i} x={x} y={y} width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
        );
      })}

      {/* Player token */}
      <circle cx={22.5} cy={22.5} r="6" className="fill-blue-500" opacity="0.6" />

      {/* Enemy token */}
      <circle cx={72.5} cy={72.5} r="6" className="fill-red-500" opacity="0.4" />

      {/* Treasure */}
      <rect x={55} y={17} width="10" height="10" rx="1" className="fill-yellow-400" opacity="0.5" />

      {/* Sword icon */}
      <line x1="30" y1="80" x2="45" y2="65" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" />
      <line x1="43" y1="67" x2="47" y2="63" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" strokeLinecap="round" />
    </svg>
  );
}
