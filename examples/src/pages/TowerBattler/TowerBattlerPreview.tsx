export default function TowerBattlerPreview() {
  return (
    <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true">
      {/* Enemy (skull-ish shape) */}
      <circle
        cx="60"
        cy="28"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.6"
      />
      <circle cx="54" cy="25" r="3" fill="currentColor" fillOpacity="0.5" />
      <circle cx="66" cy="25" r="3" fill="currentColor" fillOpacity="0.5" />
      <line
        x1="55"
        y1="33"
        x2="65"
        y2="33"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />

      {/* Sword icon (attack intent) */}
      <line
        x1="85"
        y1="18"
        x2="85"
        y2="38"
        stroke="#ef4444"
        strokeWidth="2"
        strokeOpacity="0.7"
      />
      <line
        x1="80"
        y1="24"
        x2="90"
        y2="24"
        stroke="#ef4444"
        strokeWidth="2"
        strokeOpacity="0.7"
      />

      {/* HP bar background */}
      <rect
        x="20"
        y="52"
        width="80"
        height="6"
        rx="3"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* HP bar fill */}
      <rect x="20" y="52" width="56" height="6" rx="3" fill="#22c55e" fillOpacity="0.7" />

      {/* Cards at bottom */}
      <rect
        x="15"
        y="68"
        width="26"
        height="38"
        rx="3"
        fill="#dc2626"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
      />
      <text x="21" y="90" fontSize="8" fontWeight="bold" fill="white">
        ATK
      </text>

      <rect
        x="47"
        y="68"
        width="26"
        height="38"
        rx="3"
        fill="#2563eb"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
      />
      <text x="53" y="90" fontSize="8" fontWeight="bold" fill="white">
        DEF
      </text>

      <rect
        x="79"
        y="68"
        width="26"
        height="38"
        rx="3"
        fill="#ea580c"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
      />
      <text x="83" y="90" fontSize="7" fontWeight="bold" fill="white">
        BASH
      </text>
    </svg>
  );
}
