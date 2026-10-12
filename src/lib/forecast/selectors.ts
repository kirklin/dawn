import type { GlowEvent, MoonOutlook, ObserverHour } from "./types";
import type { TimeRange } from "~/lib/astro/constants";
import type { MoonQuarterEvent, MoonQuarterName } from "~/lib/astro/moon";
import type { SunDay } from "~/lib/astro/sun";
import { BLUE_HOUR_BOTTOM, CURVE_STEP_MINUTES, GOLDEN_HOUR_BOTTOM, GOLDEN_HOUR_TOP } from "~/lib/astro/constants";
import { daysBetween, HOUR_MS, MINUTE_MS, zonedDateKey, zonedMidnight } from "~/lib/time/zoned";

/** Afterglow lasts about this long, so an event stays "current" for a while after the sun crosses the horizon. */
export const GLOW_LINGER_MS = 20 * MINUTE_MS;

export function nextGlowEvent(events: GlowEvent[], now: number) {
  return events.find(event => event.time + GLOW_LINGER_MS > now) ?? null;
}

export function dayAt(days: SunDay[], time: number) {
  return days.find(day => time >= day.start && time < day.end) ?? null;
}

/** Index of the curve sample at or before `time`, and how far `time` is toward the next one. */
function curvePosition(day: SunDay, time: number) {
  const position = (time - day.start) / (CURVE_STEP_MINUTES * MINUTE_MS);
  const index = Math.min(Math.floor(position), day.altitudes.length - 2);
  return { index, fraction: position - index };
}

export function sunAltitudeAt(days: SunDay[], time: number) {
  const day = dayAt(days, time);
  if (!day) {
    return null;
  }
  const { index, fraction } = curvePosition(day, time);
  return day.altitudes[index] + (day.altitudes[index + 1] - day.altitudes[index]) * fraction;
}

/** The sun's azimuth at `time`, degrees clockwise from north, interpolated the short way round. */
export function sunAzimuthAt(days: SunDay[], time: number) {
  const day = dayAt(days, time);
  if (!day) {
    return null;
  }
  const { index, fraction } = curvePosition(day, time);
  const from = day.azimuths[index];
  const turn = ((day.azimuths[index + 1] - from + 540) % 360) - 180;
  return (from + turn * fraction + 360) % 360;
}

/** When the sun stands highest on `day`. */
export function solarNoon(day: SunDay) {
  const highest = day.altitudes.indexOf(Math.max(...day.altitudes));
  return day.start + highest * CURVE_STEP_MINUTES * MINUTE_MS;
}

export function hourAt(hours: ObserverHour[], time: number) {
  return hours.find(hour => time >= hour.time && time < hour.time + HOUR_MS) ?? null;
}

/** How much of the night the sun path shows on each side of the daylight. */
const SUN_PATH_MARGIN_MS = 2 * HOUR_MS;

/**
 * The part of `day` the sun path shows: from two hours before sunrise to two hours after sunset, within the
 * day, so the curve stands even about noon. A day whose sun does not rise and set once, in that order, is shown whole.
 */
export function sunPathRange(day: SunDay): TimeRange {
  const { sunrise, sunset } = day;
  if ((sunrise === null && sunset === null) || (sunrise !== null && sunset !== null && sunset < sunrise)) {
    return [day.start, day.end];
  }
  return [
    sunrise === null ? day.start : Math.max(day.start, sunrise - SUN_PATH_MARGIN_MS),
    sunset === null ? day.end : Math.min(day.end, sunset + SUN_PATH_MARGIN_MS),
  ];
}

/** The first sunrise or sunset after `time`. */
export function nextSunCrossing(days: SunDay[], time: number) {
  for (const day of days) {
    for (const kind of ["sunrise", "sunset"] as const) {
      const crossing = day[kind];
      if (crossing !== null && crossing > time) {
        return { kind, time: crossing };
      }
    }
  }
  return null;
}

export type LightPhaseName = "day" | "golden" | "blue" | "night";

/** What photographers call the light at a sun altitude, in degrees. */
export function lightPhaseAt(altitude: number): LightPhaseName {
  if (altitude >= GOLDEN_HOUR_TOP) {
    return "day";
  }
  if (altitude >= GOLDEN_HOUR_BOTTOM) {
    return "golden";
  }
  return altitude >= BLUE_HOUR_BOTTOM ? "blue" : "night";
}

/** The sunrise or sunset closest in time to `time`. */
export function nearestEvent(events: GlowEvent[], time: number) {
  let nearest: GlowEvent | null = null;
  for (const event of events) {
    if (!nearest || Math.abs(event.time - time) < Math.abs(nearest.time - time)) {
      nearest = event;
    }
  }
  return nearest;
}

export interface LightPhase {
  kind: "golden" | "blue";
  range: TimeRange;
}

/** The blue and golden hour around a sunrise or sunset, in the order they happen. */
export function lightPhases(event: Pick<GlowEvent, "kind" | "date">, days: SunDay[]): LightPhase[] {
  const day = days.find(entry => entry.date === event.date);
  if (!day) {
    throw new Error(`No sun day for the ${event.kind} on ${event.date}`);
  }
  const phases = event.kind === "sunrise"
    ? [{ kind: "blue", range: day.blueMorning }, { kind: "golden", range: day.goldenMorning }] as const
    : [{ kind: "golden", range: day.goldenEvening }, { kind: "blue", range: day.blueEvening }] as const;
  return phases.flatMap(phase => phase.range ? [{ kind: phase.kind, range: phase.range }] : []);
}

export function eventId(event: Pick<GlowEvent, "kind" | "date">) {
  return `${event.date}-${event.kind}`;
}

/** The moonrise or moonset that comes first after `now`. */
export function nextMoonCrossing(moon: Pick<MoonOutlook, "nextRise" | "nextSet">, now: number) {
  const crossings = [
    { kind: "moonrise", time: moon.nextRise },
    { kind: "moonset", time: moon.nextSet },
  ] as const;
  let next: { kind: (typeof crossings)[number]["kind"]; time: number } | null = null;
  for (const crossing of crossings) {
    if (crossing.time !== null && crossing.time > now && (!next || crossing.time < next.time)) {
      next = { kind: crossing.kind, time: crossing.time };
    }
  }
  return next;
}

/** Calendar days until the next `quarter` in the place's time zone; 0 when it falls today. */
export function daysUntilQuarter(quarters: MoonQuarterEvent[], quarter: MoonQuarterName, now: number, timeZone: string) {
  const today = zonedDateKey(now, timeZone);
  const startOfToday = zonedMidnight(today, timeZone);
  const event = quarters.find(entry => entry.quarter === quarter && entry.time >= startOfToday);
  return event ? daysBetween(today, zonedDateKey(event.time, timeZone)) : null;
}
