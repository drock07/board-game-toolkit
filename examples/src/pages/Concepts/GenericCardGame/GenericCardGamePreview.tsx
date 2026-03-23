export default function GenericCardGamePreview() {
  return (
    <svg viewBox="0 0 120 80" className="size-24" aria-hidden="true">
      {/* Deck — staggered stack of face-down cards */}
      <rect x="6" y="20" width="22" height="32" rx="2" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <rect x="9" y="17" width="22" height="32" rx="2" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <rect x="12" y="14" width="22" height="32" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />

      {/* Hand — three cards fanned */}
      <rect x="42" y="24" width="16" height="23" rx="2" fill="white" fillOpacity="0.6" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" transform="rotate(-12 50 35)" />
      <rect x="52" y="18" width="16" height="23" rx="2" fill="white" fillOpacity="0.8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
      <rect x="62" y="24" width="16" height="23" rx="2" fill="white" fillOpacity="0.6" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" transform="rotate(12 70 35)" />
      {/* Suit symbols on center hand card */}
      <text x="55" y="30" fontSize="7" fill="#ef4444" fillOpacity="0.8">♥</text>
      <text x="55" y="38" fontSize="5" fill="#1f2937" fillOpacity="0.6">A</text>

      {/* Discard — single face-up card */}
      <rect x="90" y="14" width="22" height="32" rx="2" fill="white" fillOpacity="0.85" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
      <text x="93" y="25" fontSize="7" fill="#1f2937" fillOpacity="0.7">K</text>
      <text x="93" y="34" fontSize="9" fill="#1f2937" fillOpacity="0.6">♠</text>

      {/* Zone labels */}
      <text x="14" y="54" fontSize="6" fill="currentColor" fillOpacity="0.5" textAnchor="middle">Deck</text>
      <text x="60" y="54" fontSize="6" fill="currentColor" fillOpacity="0.5" textAnchor="middle">Hand</text>
      <text x="101" y="54" fontSize="6" fill="currentColor" fillOpacity="0.5" textAnchor="middle">Discard</text>
    </svg>
  );
}
