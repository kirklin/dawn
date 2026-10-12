import type { GlowEvent, MoonOutlook, ObserverHour } from "./types";
import type { TimeRange } from "~/lib/astro/constants";
import type { MoonQuarterEvent, MoonQuarterName } from "~/lib/astro/moon";
import type { SunDay } from "~/lib/astro/sun";
import { CURVE_STEP_MINUTES } from "~/lib/astro/constants";
import { daysBetween, HOUR_MS, MINUTE_MS, zonedDateKey, zonedMidnight } from "~/lib/time/zoned";

/** Afterglow lasts about this long, so an event stays "current" for a while after the sun crosses the horizon. */
export const GLOW_LINGER_MS = 20 * MINUTE_MS;

export function nextGlowEvent(events: GlowEvent[], now: number) {
  return events.find(event => event.time + GLOW_LINGER_MS > now) ?? null;
}

export function dayAt(days: SunDay[], time: number) {
  return days.find(day => time >= day.start && time < day.end) ?? null;
}

export function sunAltitudeAt(days: SunDay[], time: number) {
  const day = dayAt(days, time);
  if (!day) {
    return null;
  }
  const position = (time - day.start) / (CURVE_STEP_MINUTES * MINUTE_MS);
  const index = Math.min(Math.floor(position), day.altitudes.length - 2);
  const fraction = position - index;
  return day.altitudes[index] + (day.altitudes[index + 1] - day.altitudes[index]) * fraction;
}

export function hourAt(hours: ObserverHour[], time: number) {
  return hours.find(hour => time >= hour.time && time < hour.time + HOUR_MS) ?? null;
}

/** The next sunrise or sunset after `now`, the way the iOS Weather sunset tile shows it. */
export function nextSunCrossing(days: SunDay[], now: number) {
  for (const day of days) {
    for (const kind of ["sunrise", "sunset"] as const) {
      const time = day[kind];
      if (time !== null && time > now) {
        return { kind, time, day };
      }
    }
  }
  return null;
}

export interface LightSession {
  period: "morning" | "evening";
  golden: TimeRange | null;
  blue: TimeRange | null;
  start: number;
  end: number;
}

/** The golden-and-blue-hour session in progress or next to come. */
export function nextLightSession(days: SunDay[], now: number): LightSession | null {
  for (const day of days) {
    const sessions: LightSession[] = [];
    const morning = [day.blueMorning, day.goldenMorning].filter(range => range !== null);
    if (morning.length > 0) {
      sessions.push({ period: "morning", golden: day.goldenMorning, blue: day.blueMorning, start: morning[0][0], end: morning[morning.length - 1][1] });
    }
    const evening = [day.goldenEvening, day.blueEvening].filter(range => range !== null);
    if (evening.length > 0) {
      sessions.push({ period: "evening", golden: day.goldenEvening, blue: day.blueEvening, start: evening[0][0], end: evening[evening.length - 1][1] });
    }
    const session = sessions.find(candidate => candidate.end > now);
    if (session) {
      return session;
    }
  }
  return null;
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
