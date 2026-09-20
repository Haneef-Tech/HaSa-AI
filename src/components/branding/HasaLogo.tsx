import React, { useId } from "react";

interface HasaLogoProps {
  className?: string;
  size?: number;
  /** Set false to freeze the orbital animation (e.g. tiny icon contexts). */
  animated?: boolean;
}

/**
 * HaSa AI mark v2 — a faceted "neural nexus": concentric gradient rings,
 * an orbiting satellite node and a radiant core. Same component API as v1,
 * so all existing usages pick up the new mark automatically.
 */
export const HasaLogo: React.FC<HasaLogoProps> = ({ className = "", size = 28, animated = true }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ring = `hasa-ring-${uid}`;
  const core = `hasa-core-${uid}`;
  const glow = `hasa-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HaSa AI Logo"
      role="img"
    >
      <defs>
        <linearGradient id={ring} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="0.45" stopColor="#7C3AED" />
          <stop offset="0.75" stopColor="#6366F1" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <radialGradient id={core} cx="0.5" cy="0.42" r="0.65">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#7C3AED" stopOpacity="0.15" />
        </radialGradient>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer orbit track */}
      <circle cx="24" cy="24" r="20.5" stroke={`url(#${ring})`} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 5" />

      {/* Faceted nexus shell */}
      <path
        d="M24 6L39.5 15v18L24 42L8.5 33V15L24 6Z"
        stroke={`url(#${ring})`}
        strokeWidth="2.4"
        strokeLinejoin="round"
        filter={`url(#${glow})`}
      />
      {/* Inner lattice */}
      <path
        d="M24 13.5L33 18.7v10.6L24 34.5l-9-5.2V18.7l9-5.2Z"
        stroke={`url(#${ring})`}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeOpacity="0.85"
      />
      {/* Cross links */}
      <path d="M24 6v7.5M24 34.5V42M8.5 15l5.6 3.7M39.5 15l-5.6 3.7M8.5 33l5.6-3.7M39.5 33l-5.6-3.7" stroke={`url(#${ring})`} strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />

      {/* Orbiting satellite */}
      {animated ? (
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 24 24"
            to="360 24 24"
            dur="7s"
            repeatCount="indefinite"
          />
          <circle cx="24" cy="3.5" r="2.6" fill="#22D3EE" />
          <circle cx="24" cy="3.5" r="4.4" stroke="#22D3EE" strokeOpacity="0.4" strokeWidth="1" />
        </g>
      ) : (
        <circle cx="24" cy="3.5" r="2.6" fill="#22D3EE" />
      )}

      {/* Radiant core */}
      <circle cx="24" cy="24" r="5.2" fill={`url(#${core})`} filter={`url(#${glow})`}>
        {animated && (
          <animate attributeName="r" values="5.2;6;5.2" dur="2.8s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
};
