"use client";

import type { CloudLayers } from "~/lib/forecast/glow";
import { PATH_DISTANCES_KM } from "~/lib/forecast/models";

const WIDTH = 320;
const HEIGHT = 150;
const TOP_KM = 12;
const MAX_KM = 400;
const BANDS = [
  { key: "high", from: 8, to: 12 },
  { key: "mid", from: 3, to: 8 },
  { key: "low", from: 0, to: 3 },
] as const;

const x = (km: number) => (km / MAX_KM) * WIDTH;
const y = (heightKm: number) => HEIGHT - (heightKm / TOP_KM) * HEIGHT;

/** Edges of the column around each sampled distance, halfway to its neighbours. */
function columnEdges(index: number) {
  const distance = PATH_DISTANCES_KM[index];
  const previous = index > 0 ? PATH_DISTANCES_KM[index - 1] : distance;
  const next = index < PATH_DISTANCES_KM.length - 1 ? PATH_DISTANCES_KM[index + 1] : MAX_KM;
  return { from: (distance + previous) / 2, to: index === PATH_DISTANCES_KM.length - 1 ? MAX_KM : (distance + next) / 2 };
}

/**
 * Light that reddens clouds overhead about 3° of sun depression after sunset grazes the
 * ground near 333 km out; this traces its height (km) above each point on the way in.
 */
function rayHeight(km: number) {
  const tangentKm = 333;
  return 0.5 + (tangentKm - km) ** 2 / (2 * 6371);
}

export function SectionChart({ section }: { section: CloudLayers[] }) {
  const ray = Array.from({ length: 41 }, (_, index) => index * 10)
    .map((km, index) => `${index === 0 ? "M" : "L"}${x(km).toFixed(1)} ${y(rayHeight(km)).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" aria-hidden>
      {BANDS.map(band => (
        <line key={band.key} x1="0" x2={WIDTH} y1={y(band.from)} y2={y(band.from)} stroke="white" strokeOpacity="0.12" />
      ))}
      {section.map((layers, index) => {
        const { from, to } = columnEdges(index);
        return BANDS.map(band => (
          <rect
            key={`${PATH_DISTANCES_KM[index]}-${band.key}`}
            x={x(from) + 1}
            y={y(band.to) + 2}
            width={Math.max(1, x(to) - x(from) - 2)}
            height={y(band.from) - y(band.to) - 4}
            rx="4"
            fill="white"
            fillOpacity={0.05 + 0.8 * layers[band.key]}
          />
        ));
      })}
      <path d={ray} fill="none" stroke="#ff9f0a" strokeWidth="2" strokeDasharray="5 4" />
      <circle cx={WIDTH - 6} cy={HEIGHT - 2} r="6" fill="#ff9f0a" />
    </svg>
  );
}
