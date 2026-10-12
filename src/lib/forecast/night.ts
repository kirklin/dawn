import type { Observer } from "astronomy-engine";
import type { ObserverHour } from "./types";
import type { TimeRange } from "~/lib/astro/constants";
import { Body, SearchAltitude } from "astronomy-engine";
import { ASTRONOMICAL_TWILIGHT, BEST_HOUR_SCORE, FAINT_MOON, NAUTICAL_TWILIGHT } from "~/lib/astro/constants";
import { moonAltitude, moonState } from "~/lib/astro/moon";
import { HOUR_MS } from "~/lib/time/zoned";

export type StargazingRating = "excellent" | "good" | "fair" | "poor";

export interface NightHour {
  time: number;
  cloud: number;
  moonUp: boolean;
  score: number;
}

export interface NightOutlook {
  start: number;
  end: number;
  /** "nautical" when the sun never reaches −18° (short summer nights at high latitude). */
  darkness: "astronomical" | "nautical";
  moonIllumination: number;
  hours: NightHour[];
  best: TimeRange | null;
  score: number;
  rating: StargazingRating;
  aod: number | null;
}

function darknessWindow(observer: Observer, now: number, depression: number) {
  const search = (direction: 1 | -1, from: number, limitDays: number) => {
    const time = SearchAltitude(Body.Sun, observer, direction, new Date(from), limitDays, depression);
    return time ? time.date.getTime() : null;
  };
  // The night in progress if the sun is already below `depression`, otherwise the coming one.
  const dawn = search(1, now, 1);
  const dusk = search(-1, now, 1);
  if (dawn === null || dusk === null) {
    return null;
  }
  if (dawn < dusk) {
    const start = search(-1, dawn, -1);
    return start === null ? null : [start, dawn] as const;
  }
  const end = search(1, dusk, 1);
  return end === null ? null : [dusk, end] as const;
}

export function nightOutlook(observer: Observer, hours: ObserverHour[], now: number): NightOutlook | null {
  let darkness: NightOutlook["darkness"] = "astronomical";
  let window = darknessWindow(observer, now, ASTRONOMICAL_TWILIGHT);
  if (!window) {
    darkness = "nautical";
    window = darknessWindow(observer, now, NAUTICAL_TWILIGHT);
  }
  if (!window) {
    return null;
  }
  const [start, end] = window;

  const moonIllumination = moonState((start + end) / 2).illumination;
  const nightHours = hours.filter(hour => hour.time + HOUR_MS > start && hour.time < end);
  const aods = nightHours.map(hour => hour.aod).filter(value => value !== null);
  const aod = aods.length > 0 ? aods.reduce((sum, value) => sum + value, 0) / aods.length : null;
  const transparency = aod === null ? 1 : Math.exp(-1.2 * Math.max(0, aod - 0.1));

  const scored = nightHours.map((hour) => {
    const middle = Math.min(end, Math.max(start, hour.time + HOUR_MS / 2));
    const moonUp = moonAltitude(observer, middle) > 0;
    const moonlight = moonUp && moonIllumination >= FAINT_MOON ? 1 - 0.85 * moonIllumination : 1;
    return {
      time: hour.time,
      cloud: hour.cloud,
      moonUp,
      score: (1 - hour.cloud) ** 1.5 * moonlight * transparency,
    };
  });

  let best: TimeRange | null = null;
  let runStart: number | null = null;
  for (const hour of scored) {
    if (hour.score < BEST_HOUR_SCORE) {
      runStart = null;
      continue;
    }
    runStart ??= Math.max(start, hour.time);
    const runEnd = Math.min(end, hour.time + HOUR_MS);
    if (!best || runEnd - runStart > best[1] - best[0]) {
      best = [runStart, runEnd];
    }
  }

  const top = scored.map(hour => hour.score).sort((a, b) => b - a).slice(0, 3);
  const score = top.length > 0 ? top.reduce((sum, value) => sum + value, 0) / top.length : 0;
  const rating: StargazingRating = score >= 0.75 ? "excellent" : score >= 0.55 ? "good" : score >= 0.35 ? "fair" : "poor";

  return { start, end, darkness, moonIllumination, hours: scored, best, score, rating, aod };
}
