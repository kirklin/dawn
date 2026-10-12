"use client";

import { useTranslations } from "next-intl";
import { roundForMarkup } from "~/components/sky/markup";

const SIZE = 120;
const CENTER = SIZE / 2;
const RIM = 54;
const CARDINALS = [
  { key: "north", degrees: 0 },
  { key: "east", degrees: 90 },
  { key: "south", degrees: 180 },
  { key: "west", degrees: 270 },
] as const;

/** Screen point at `radius` along azimuth `degrees` (0 = north, clockwise). */
function polar(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: roundForMarkup(CENTER + radius * Math.sin(radians)),
    y: roundForMarkup(CENTER - radius * Math.cos(radians)),
  };
}

interface CompassDialProps {
  markers: { key: string; azimuth: number; color: string }[];
  className?: string;
}

/** Compass rose in the style of the iOS wind tile, with a needle for each marker. */
export function CompassDial({ markers, className }: CompassDialProps) {
  const direction = useTranslations("Direction");

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={className} aria-hidden>
      {Array.from({ length: 72 }, (_, index) => {
        const degrees = index * 5;
        const major = degrees % 30 === 0;
        const outer = polar(degrees, RIM);
        const inner = polar(degrees, RIM - (major ? 7 : 4));
        return (
          <line
            key={degrees}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke="white"
            strokeOpacity={major ? 0.8 : 0.35}
            strokeWidth={major ? 1.5 : 1}
          />
        );
      })}
      {CARDINALS.map((cardinal) => {
        const point = polar(cardinal.degrees, RIM - 22);
        return (
          <text
            key={cardinal.key}
            x={point.x}
            y={point.y}
            fill="white"
            fillOpacity={0.85}
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {direction(cardinal.key)}
          </text>
        );
      })}
      {markers.map((marker) => {
        const tip = polar(marker.azimuth, RIM - 2);
        const tail = polar(marker.azimuth, RIM - 13);
        return (
          <g key={marker.key}>
            <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={marker.color} strokeWidth="3" strokeLinecap="round" />
            <circle cx={tip.x} cy={tip.y} r="5" fill={marker.color} />
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r="3" fill="white" fillOpacity={0.85} />
    </svg>
  );
}
