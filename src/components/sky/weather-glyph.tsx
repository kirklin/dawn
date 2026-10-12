import type { GlyphKind } from "./glyphs";
import { roundForMarkup } from "./markup";

const SUN = "#FFD60A";
const MOON = "#F2F2F7";
const RAIN = "#64D2FF";

function Rays({ cx, cy, inner, outer, width }: { cx: number; cy: number; inner: number; outer: number; width: number }) {
  return (
    <g stroke={SUN} strokeWidth={width} strokeLinecap="round">
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4;
        return (
          <line
            key={index}
            x1={roundForMarkup(cx + inner * Math.cos(angle))}
            y1={roundForMarkup(cy + inner * Math.sin(angle))}
            x2={roundForMarkup(cx + outer * Math.cos(angle))}
            y2={roundForMarkup(cy + outer * Math.sin(angle))}
          />
        );
      })}
    </g>
  );
}

function Cloud({ dx = 0, dy = 0 }: { dx?: number; dy?: number }) {
  return (
    <g fill="white" transform={`translate(${dx} ${dy})`}>
      <circle cx="13" cy="17" r="6" />
      <circle cx="20.5" cy="18.5" r="5" />
      <rect x="6.5" y="17" width="19.5" height="7" rx="3.5" />
    </g>
  );
}

function Crescent({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <path
      fill={MOON}
      d={`M${cx + r * 0.2} ${cy - r} A${r} ${r} 0 1 0 ${cx + r} ${cy + r * 0.45} A${r * 0.82} ${r * 0.82} 0 0 1 ${cx + r * 0.2} ${cy - r} Z`}
    />
  );
}

function HorizonSun({ rising }: { rising: boolean }) {
  return (
    <>
      <path d="M10 22 A6 6 0 0 1 22 22 Z" fill={SUN} />
      <g stroke={SUN} strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="17.5" x2="7" y2="18.5" />
        <line x1="27" y1="17.5" x2="25" y2="18.5" />
      </g>
      <line x1="4" y1="23.5" x2="28" y2="23.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {rising
          ? <path d="M16 13 V5 M12.5 8.5 L16 5 L19.5 8.5" />
          : <path d="M16 5 V13 M12.5 9.5 L16 13 L19.5 9.5" />}
      </g>
    </>
  );
}

export function WeatherGlyph({ kind, className }: { kind: GlyphKind; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {kind === "clear-day" && (
        <>
          <Rays cx={16} cy={16} inner={9.5} outer={13} width={2.2} />
          <circle cx="16" cy="16" r="6.5" fill={SUN} />
        </>
      )}
      {kind === "clear-night" && <Crescent cx={15} cy={16} r={9} />}
      {kind === "partly-day" && (
        <>
          <Rays cx={20} cy={11} inner={6.5} outer={9} width={1.8} />
          <circle cx="20" cy="11" r="4.5" fill={SUN} />
          <Cloud dx={-2} dy={2} />
        </>
      )}
      {kind === "partly-night" && (
        <>
          <Crescent cx={20} cy={10} r={6} />
          <Cloud dx={-2} dy={2} />
        </>
      )}
      {kind === "cloudy" && <Cloud dy={-2} />}
      {kind === "rain" && (
        <>
          <Cloud dy={-6} />
          <g stroke={RAIN} strokeWidth="2" strokeLinecap="round">
            <line x1="11" y1="23" x2="9.5" y2="27" />
            <line x1="16.5" y1="23" x2="15" y2="27" />
            <line x1="22" y1="23" x2="20.5" y2="27" />
          </g>
        </>
      )}
      {kind === "sunrise" && <HorizonSun rising />}
      {kind === "sunset" && <HorizonSun rising={false} />}
    </svg>
  );
}
