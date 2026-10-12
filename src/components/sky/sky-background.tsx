import { roundForMarkup } from "./markup";
import { rgb, skyColors } from "./palette";

const STAR_COUNT = 90;

/** Deterministic star field so server and client render the same sky. */
const STARS = (() => {
  let seed = 20261012;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: STAR_COUNT }, () => ({
    x: random() * 100,
    y: random() * 72,
    radius: 0.4 + random() * 0.9,
    opacity: 0.35 + random() * 0.65,
    delay: random() * 6,
  }));
})();

const CLOUD_BANKS = [
  { top: "6%", left: "-20%", width: "90%", height: "34%", duration: 95 },
  { top: "18%", left: "35%", width: "85%", height: "30%", duration: 120 },
  { top: "42%", left: "-10%", width: "80%", height: "28%", duration: 140 },
  { top: "64%", left: "30%", width: "95%", height: "32%", duration: 110 },
];

interface SkyBackgroundProps {
  altitude: number;
  cloud: number;
}

export function SkyBackground({ altitude, cloud }: SkyBackgroundProps) {
  const colors = skyColors(altitude, cloud);
  const starOpacity = roundForMarkup(Math.max(0, Math.min(1, (-altitude - 8) / 8)) * (1 - cloud) ** 2);
  const daylight = Math.max(0, Math.min(1, (altitude + 8) / 14));
  const bankColor = daylight > 0.5 ? "255 255 255" : "190 198 214";
  const bankOpacity = Math.min(0.75, cloud * (0.35 + 0.4 * daylight));

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${rgb(colors.top)} 0%, ${rgb(colors.bottom)} 100%)` }}
    >
      {starOpacity > 0.02 && (
        <svg className="absolute inset-0 size-full" style={{ opacity: starOpacity }}>
          {STARS.map(star => (
            <circle
              key={`${star.x}-${star.y}`}
              className="animate-twinkle"
              cx={`${star.x}%`}
              cy={`${star.y}%`}
              r={star.radius}
              fill="white"
              opacity={star.opacity}
              style={{ animationDelay: `${star.delay}s` }}
            />
          ))}
        </svg>
      )}
      {bankOpacity > 0.02 && CLOUD_BANKS.map(bank => (
        <div
          key={bank.top}
          className="absolute animate-drift"
          style={{
            top: bank.top,
            left: bank.left,
            width: bank.width,
            height: bank.height,
            opacity: bankOpacity,
            background: `radial-gradient(closest-side, rgb(${bankColor} / 0.55), rgb(${bankColor} / 0))`,
            animationDuration: `${bank.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
