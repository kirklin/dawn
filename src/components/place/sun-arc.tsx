"use client";

import { useId } from "react";

const WIDTH = 300;

interface SunArcProps {
  /** Altitudes sampled evenly across the day. */
  altitudes: number[];
  /** Position of "now" across the day, 0–1, or null when the day is not today. */
  progress: number | null;
  /** Day fractions marked with small dots (first and last light). */
  marks?: number[];
  height: number;
  grid?: boolean;
  className?: string;
}

export function SunArc({ altitudes, progress, marks = [], height, grid, className }: SunArcProps) {
  const id = useId().replace(/:/g, "");
  const padding = 6;
  const amplitude = Math.max(...altitudes.map(Math.abs), 1);
  const horizon = height / 2;
  const x = (fraction: number) => fraction * WIDTH;
  const y = (altitude: number) => horizon - (altitude / amplitude) * (horizon - padding);
  const altitudeAt = (fraction: number) => {
    const position = fraction * (altitudes.length - 1);
    const index = Math.min(Math.floor(position), altitudes.length - 2);
    return altitudes[index] + (altitudes[index + 1] - altitudes[index]) * (position - index);
  };

  const curve = altitudes
    .map((altitude, index) => `${index === 0 ? "M" : "L"}${x(index / (altitudes.length - 1)).toFixed(1)} ${y(altitude).toFixed(1)}`)
    .join(" ");
  const sun = progress === null ? null : { cx: x(progress), cy: y(altitudeAt(progress)), up: altitudeAt(progress) > 0 };
  const above = `above-${id}`;
  const below = `below-${id}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className={className} aria-hidden>
      <defs>
        <clipPath id={above}>
          <rect x="0" y="0" width={WIDTH} height={horizon} />
        </clipPath>
        <clipPath id={below}>
          <rect x="0" y={horizon} width={WIDTH} height={height - horizon} />
        </clipPath>
      </defs>
      {grid && [0.25, 0.5, 0.75].map(fraction => (
        <line key={fraction} x1={x(fraction)} x2={x(fraction)} y1="0" y2={height} stroke="white" strokeOpacity="0.12" strokeDasharray="3 4" />
      ))}
      {grid && <path d={`${curve} L${WIDTH} ${horizon} L0 ${horizon} Z`} fill="white" fillOpacity="0.1" clipPath={`url(#${above})`} />}
      <line x1="0" x2={WIDTH} y1={horizon} y2={horizon} stroke="white" strokeOpacity="0.45" strokeWidth="1" />
      <path d={curve} fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="2.5" clipPath={`url(#${above})`} />
      <path d={curve} fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" clipPath={`url(#${below})`} />
      {marks.map(mark => (
        <circle key={mark} cx={x(mark)} cy={y(altitudeAt(mark))} r="3" fill="white" fillOpacity="0.7" />
      ))}
      {sun && <circle cx={sun.cx} cy={sun.cy} r="6" fill="white" fillOpacity={sun.up ? 1 : 0.55} />}
    </svg>
  );
}
