"use client";

import { useId } from "react";
import { roundForMarkup } from "./markup";

const CENTER = 50;
const RADIUS = 48;

/** Dark lunar seas, in disc coordinates scaled to RADIUS. */
const MARIA = [
  { x: -0.35, y: -0.35, rx: 0.24, ry: 0.2 },
  { x: 0.12, y: -0.38, rx: 0.15, ry: 0.13 },
  { x: 0.28, y: -0.1, rx: 0.18, ry: 0.15 },
  { x: 0.66, y: -0.26, rx: 0.1, ry: 0.08 },
  { x: -0.58, y: 0.02, rx: 0.22, ry: 0.32 },
  { x: -0.2, y: 0.36, rx: 0.16, ry: 0.12 },
  { x: 0.55, y: 0.14, rx: 0.12, ry: 0.11 },
  { x: 0.36, y: 0.28, rx: 0.08, ry: 0.07 },
  { x: -0.46, y: 0.4, rx: 0.08, ry: 0.07 },
];

/** Outline of the sunlit part for an elongation `phaseAngle` (0 new, 90 first quarter, 180 full). */
function litPath(phaseAngle: number) {
  const angle = ((phaseAngle % 360) + 360) % 360;
  const waxing = angle < 180;
  const terminatorRadius = roundForMarkup(Math.abs(Math.cos((angle * Math.PI) / 180)) * RADIUS);
  const terminatorSweep = angle % 180 < 90 ? 0 : 1;
  const top = `${CENTER} ${CENTER - RADIUS}`;
  const bottom = `${CENTER} ${CENTER + RADIUS}`;
  return [
    `M${top}`,
    `A${RADIUS} ${RADIUS} 0 0 ${waxing ? 1 : 0} ${bottom}`,
    `A${terminatorRadius} ${RADIUS} 0 0 ${terminatorSweep} ${top}`,
    "Z",
  ].join(" ");
}

interface MoonDiscProps {
  phaseAngle: number;
  className?: string;
}

export function MoonDisc({ phaseAngle, className }: MoonDiscProps) {
  const id = useId().replace(/:/g, "");
  const surfaceId = `moon-surface-${id}`;
  const blurId = `moon-blur-${id}`;
  const litId = `moon-lit-${id}`;

  const surface = (
    <g>
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={`url(#${surfaceId})`} />
      <g filter={`url(#${blurId})`} fill="#8f8a80" opacity={0.55}>
        {MARIA.map(mare => (
          <ellipse
            key={`${mare.x},${mare.y}`}
            cx={CENTER + mare.x * RADIUS}
            cy={CENTER + mare.y * RADIUS}
            rx={mare.rx * RADIUS}
            ry={mare.ry * RADIUS}
          />
        ))}
      </g>
    </g>
  );

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={surfaceId} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#f4f1ea" />
          <stop offset="100%" stopColor="#bdb8ad" />
        </radialGradient>
        <filter id={blurId}>
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id={litId}>
          <path d={litPath(phaseAngle)} />
        </clipPath>
      </defs>
      <g opacity={0.14}>{surface}</g>
      <g clipPath={`url(#${litId})`}>{surface}</g>
    </svg>
  );
}
