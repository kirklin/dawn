"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { TimeRange } from "~/lib/astro/constants";
import type { SunDay } from "~/lib/astro/sun";
import { useTranslations } from "next-intl";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { roundForMarkup } from "~/components/sky/markup";
import { CURVE_STEP_MINUTES } from "~/lib/astro/constants";
import { sunAltitudeAt } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";
import { MINUTE_MS, zonedParts } from "~/lib/time/zoned";
import { cn } from "~/lib/utils";
import { percent } from "./glow-style";

const WIDTH = 1000;
/** Plot height in CSS pixels; the drawing uses the same units vertically. */
const HEIGHT = 180;
/** Keeps the sun inside the plot at the top and bottom of its path. */
const PADDING = 12;
/** Room kept on both sides of the horizon for the sunrise and sunset times. */
const LABEL_ROOM = 36;
/** Space between a horizon crossing and its time. */
const LABEL_GAP = 8;
/** Minutes between the ticks of the time scale; the ticks on the hour are longer. */
const TICK_MINUTES = 30;
/** The time scale stops at the side margins of the cards below, in CSS pixels. */
const SCALE_INSET = 16;
/** A drag has to move this far, mostly sideways, before it moves the time instead of the page. */
const DRAG_THRESHOLD = 6;
/** Arrow keys step the time by this much. */
const KEY_STEP_MS = 10 * MINUTE_MS;

type CrossingKind = "sunrise" | "sunset";

interface Crossing {
  kind: CrossingKind;
  time: number;
}

/** Plot y of a sun altitude: one scale above and below the horizon, leaving LABEL_ROOM on each side of it. */
function altitudeScale(altitudes: number[]) {
  let top = Math.max(...altitudes, 0);
  let bottom = Math.min(...altitudes, 0);
  const inner = HEIGHT - 2 * PADDING;
  const share = (LABEL_ROOM - PADDING) / inner;
  if (-bottom < share * (top - bottom)) {
    bottom = (-share * top) / (1 - share);
  }
  if (top < share * (top - bottom)) {
    top = (-share * bottom) / (1 - share);
  }
  return (altitude: number) => PADDING + ((top - altitude) / (top - bottom)) * inner;
}

/** The sun's altitude at `time` within `day`, its last sample standing for the instant the day ends. */
function altitudeAt(day: SunDay, time: number) {
  const altitude = sunAltitudeAt([day], Math.min(time, day.end - 1));
  if (altitude === null) {
    throw new Error(`${new Date(time).toISOString()} is outside the day ${day.date}`);
  }
  return altitude;
}

interface Tick {
  time: number;
  /** On the hour by the local clock. */
  hour: boolean;
}

/** Ticks through `range` by the local clock, placed by their instants so a daylight saving day keeps its true length. */
function scaleTicks(day: SunDay, [start, end]: TimeRange, timeZone: string): Tick[] {
  const ticks: Tick[] = [];
  for (let time = day.start; time <= end; time += TICK_MINUTES * MINUTE_MS) {
    if (time >= start) {
      ticks.push({ time, hour: zonedParts(time, timeZone).minute === 0 });
    }
  }
  return ticks;
}

/**
 * Offset, inside the inset scale, of the point at `fraction` of the full width, so the ticks line up with
 * the curve above them; the ones that fall in the margins are cut off.
 */
function scaleOffset(fraction: number) {
  return `${roundForMarkup(fraction * 100)}% + ${roundForMarkup((2 * fraction - 1) * SCALE_INSET)}px`;
}

interface Widths {
  plot: number;
  sunrise: number;
  sunset: number;
}

/**
 * Puts each sunrise and sunset time just under the horizon on the daytime side of its crossing, where the
 * curve is above the horizon. When the day is too short for both, they go above the horizon on the night side.
 */
function labelStyles(crossings: Crossing[], at: (time: number) => number, horizon: number, widths: Widths | null) {
  const below = horizon + LABEL_GAP;
  if (!widths) {
    return crossings.map(crossing => ({
      top: below,
      left: percent(at(crossing.time)),
      transform: crossing.kind === "sunrise" ? `translateX(${LABEL_GAP}px)` : `translateX(calc(-100% - ${LABEL_GAP}px))`,
    }) satisfies CSSProperties);
  }

  const spans = (daySide: boolean) => crossings.map((crossing) => {
    const x = at(crossing.time) * widths.plot;
    const width = widths[crossing.kind];
    const left = (crossing.kind === "sunrise") === daySide ? x + LABEL_GAP : x - LABEL_GAP - width;
    return { left, right: left + width };
  });
  const daySide = spans(true);
  const inside = daySide.every(span => span.left >= 0 && span.right <= widths.plot);
  const apart = daySide.length < 2 || daySide[0].right + LABEL_GAP <= daySide[1].left || daySide[1].right + LABEL_GAP <= daySide[0].left;
  if (inside && apart) {
    return daySide.map(span => ({ top: below, left: span.left }) satisfies CSSProperties);
  }
  return spans(false).map(span => ({
    top: horizon - LABEL_GAP,
    left: Math.min(Math.max(span.left, 0), widths.plot - (span.right - span.left)),
    transform: "translateY(-100%)",
  }) satisfies CSSProperties);
}

interface SunPathProps {
  day: SunDay;
  /** The part of the day shown across the width, from sunPathRange. */
  range: TimeRange;
  /** The moment shown. */
  time: number;
  timeZone: string;
  onScrub: (time: number) => void;
  onScrubEnd: () => void;
}

/**
 * The sun's path through the daylight, like the iOS sunrise card: the altitude curve over the horizon,
 * leaving the screen on both sides, sunrise and sunset, and the sun at the moment shown, above a time scale
 * whose ticks light up to that moment. Dragging along it, or tapping it, moves the moment.
 */
export function SunPath({ day, range, time, timeZone, onScrub, onScrubEnd }: SunPathProps) {
  const glow = useTranslations("Glow");
  const t = useTranslations("Place.hero");
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const sunriseLabelRef = useRef<HTMLSpanElement>(null);
  const sunsetLabelRef = useRef<HTMLSpanElement>(null);
  const gestureRef = useRef<{ pointer: number; x: number; y: number; dragging: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [widths, setWidths] = useState<Widths | null>(null);

  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot) {
      throw new Error("SunPath is not mounted");
    }
    const observer = new ResizeObserver(() => {
      setWidths({
        plot: plot.clientWidth,
        sunrise: sunriseLabelRef.current?.offsetWidth ?? 0,
        sunset: sunsetLabelRef.current?.offsetWidth ?? 0,
      });
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, [day]);

  const [start, end] = range;
  const span = end - start;
  const fraction = (at: number) => Math.min(1, Math.max(0, (at - start) / span));
  const { y, curve } = useMemo(() => {
    // The samples inside the range, and the altitudes at its two ends so the curve meets both edges.
    const points = [
      { time: start, altitude: altitudeAt(day, start) },
      ...day.altitudes.flatMap((altitude, index) => {
        const sampled = day.start + index * CURVE_STEP_MINUTES * MINUTE_MS;
        return sampled > start && sampled < end ? [{ time: sampled, altitude }] : [];
      }),
      { time: end, altitude: altitudeAt(day, end) },
    ];
    const scale = altitudeScale(points.map(point => point.altitude));
    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${roundForMarkup(((point.time - start) / (end - start)) * WIDTH)} ${roundForMarkup(scale(point.altitude))}`)
      .join(" ");
    return { y: scale, curve: path };
  }, [day, start, end]);
  const ticks = useMemo(() => scaleTicks(day, [start, end], timeZone).map(tick => (
    <span
      key={tick.time}
      className={cn("absolute top-0 w-px -translate-x-1/2 rounded-full bg-white", tick.hour ? "h-2.5" : "h-1.5")}
      style={{ left: `calc(${scaleOffset((tick.time - start) / (end - start))})` }}
    />
  )), [day, start, end, timeZone]);
  const horizon = y(0);
  const sunAltitude = altitudeAt(day, time);
  const sun = { left: fraction(time), top: y(sunAltitude) };

  const crossings = (["sunrise", "sunset"] as const).flatMap(kind => day[kind] === null ? [] : [{ kind, time: day[kind] }]);
  const labels = labelStyles(crossings, fraction, horizon, widths);

  const timeAt = (clientX: number) => {
    const element = ref.current;
    if (!element) {
      throw new Error("SunPath is not mounted");
    }
    const rect = element.getBoundingClientRect();
    return start + Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * (span - 1);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    gestureRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gestureRef.current;
    if (!current || current.pointer !== event.pointerId) {
      return;
    }
    if (!current.dragging) {
      const dx = Math.abs(event.clientX - current.x);
      if (dx < DRAG_THRESHOLD || dx < Math.abs(event.clientY - current.y)) {
        return;
      }
      current.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    onScrub(timeAt(event.clientX));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gestureRef.current;
    gestureRef.current = null;
    if (!current || current.pointer !== event.pointerId) {
      return;
    }
    if (!current.dragging) {
      onScrub(timeAt(event.clientX));
    }
    setDragging(false);
    onScrubEnd();
  };
  const onPointerCancel = () => {
    if (gestureRef.current?.dragging) {
      onScrubEnd();
    }
    gestureRef.current = null;
    setDragging(false);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? KEY_STEP_MS : event.key === "ArrowLeft" ? -KEY_STEP_MS : 0;
    if (step !== 0) {
      event.preventDefault();
      onScrub(Math.min(end - 1, Math.max(start, time + step)));
      onScrubEnd();
    }
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={t("scrub")}
      aria-valuemin={start}
      aria-valuemax={end - 1}
      aria-valuenow={time}
      aria-valuetext={formatClock(time, timeZone)}
      data-swipe-ignore
      className="relative cursor-grab touch-pan-y overflow-x-clip outline-none select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <div ref={plotRef} className="relative" style={{ height: HEIGHT }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
          aria-hidden
        >
          <defs>
            <clipPath id={`above-${id}`}>
              <rect x="0" y="0" width={WIDTH} height={horizon} />
            </clipPath>
            <clipPath id={`below-${id}`}>
              <rect x="0" y={horizon} width={WIDTH} height={HEIGHT - horizon} />
            </clipPath>
            <linearGradient id={`fill-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={PADDING} x2="0" y2={horizon}>
              <stop offset="0" stopColor="white" stopOpacity="0.18" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${curve} L${WIDTH} ${horizon} L0 ${horizon} Z`} fill={`url(#fill-${id})`} clipPath={`url(#above-${id})`} />
          <line x1="0" x2={WIDTH} y1={horizon} y2={horizon} stroke="white" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={curve} fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" clipPath={`url(#above-${id})`} />
          <path d={curve} fill="none" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" clipPath={`url(#below-${id})`} />
        </svg>
        {crossings.map((crossing, index) => (
          <span
            key={crossing.kind}
            ref={crossing.kind === "sunrise" ? sunriseLabelRef : sunsetLabelRef}
            className="text-on-sky absolute text-[13px] leading-[18px] whitespace-nowrap tabular-nums"
            style={labels[index]}
          >
            {`${glow(`sun.${crossing.kind}`)} ${formatClock(crossing.time, timeZone)}`}
          </span>
        ))}
        {dragging && <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/50" style={{ left: percent(sun.left) }} />}
        <span
          className="absolute size-3 -translate-1/2 rounded-full bg-white shadow-[0_0_12px_3px_rgb(255_255_255/0.5)]"
          style={{ left: percent(sun.left), top: sun.top, opacity: sunAltitude > 0 ? 1 : 0.6 }}
        />
      </div>

      <div className="relative mt-3 h-2.5 overflow-hidden drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)]" style={{ marginInline: SCALE_INSET }}>
        <div className="absolute inset-0 opacity-35">{ticks}</div>
        <div className="absolute inset-0" style={{ clipPath: `inset(0 calc(100% - (${scaleOffset(sun.left)})) 0 0)` }}>{ticks}</div>
      </div>
    </div>
  );
}
