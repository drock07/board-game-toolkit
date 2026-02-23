export default function TicTacToePreview() {
  return (
    <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true">
      {/* Grid lines */}
      <line x1="40" y1="4" x2="40" y2="116" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="80" y1="4" x2="80" y2="116" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="4" y1="40" x2="116" y2="40" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="4" y1="80" x2="116" y2="80" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />

      {/* X in top-left */}
      <g className="text-blue-500">
        <line x1="10" y1="10" x2="30" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="30" y1="10" x2="10" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* O in center */}
      <circle cx="60" cy="60" r="12" fill="none" stroke="#ef4444" strokeWidth="4" />

      {/* X in center-right */}
      <g className="text-blue-500">
        <line x1="90" y1="50" x2="110" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="110" y1="50" x2="90" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* O in bottom-left */}
      <circle cx="20" cy="100" r="12" fill="none" stroke="#ef4444" strokeWidth="4" />

      {/* X in bottom-center */}
      <g className="text-blue-500">
        <line x1="50" y1="90" x2="70" y2="110" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="70" y1="90" x2="50" y2="110" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
