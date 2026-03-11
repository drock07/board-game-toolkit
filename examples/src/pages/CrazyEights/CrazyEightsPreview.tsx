export default function CrazyEightsPreview() {
  return (
    <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true">
      {/* Red card */}
      <rect
        x="8"
        y="20"
        width="40"
        height="56"
        rx="4"
        fill="#ef4444"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />
      <text x="22" y="54" fontSize="20" fontWeight="bold" fill="white">
        3
      </text>

      {/* Blue card (overlapping) */}
      <rect
        x="30"
        y="14"
        width="40"
        height="56"
        rx="4"
        fill="#3b82f6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />
      <text x="43" y="48" fontSize="20" fontWeight="bold" fill="white">
        8
      </text>

      {/* Green card */}
      <rect
        x="52"
        y="50"
        width="40"
        height="56"
        rx="4"
        fill="#22c55e"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />
      <text x="65" y="85" fontSize="20" fontWeight="bold" fill="white">
        5
      </text>

      {/* Yellow card */}
      <rect
        x="72"
        y="44"
        width="40"
        height="56"
        rx="4"
        fill="#eab308"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.2"
      />
      <text x="87" y="80" fontSize="20" fontWeight="bold" fill="#1a1a1a">
        1
      </text>
    </svg>
  );
}
