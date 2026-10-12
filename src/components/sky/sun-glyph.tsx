import type { GlowEventKind } from "~/lib/forecast/types";

const SUN = "#FFD60A";

/** Half a sun on the horizon with an arrow: up for sunrise, down for sunset. */
export function SunGlyph({ kind, className }: { kind: GlowEventKind; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M10 22 A6 6 0 0 1 22 22 Z" fill={SUN} />
      <g stroke={SUN} strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="17.5" x2="7" y2="18.5" />
        <line x1="27" y1="17.5" x2="25" y2="18.5" />
      </g>
      <line x1="4" y1="23.5" x2="28" y2="23.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {kind === "sunrise"
          ? <path d="M16 13 V5 M12.5 8.5 L16 5 L19.5 8.5" />
          : <path d="M16 5 V13 M12.5 9.5 L16 13 L19.5 9.5" />}
      </g>
    </svg>
  );
}
