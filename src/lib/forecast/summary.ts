import type { GlowEvent, PlaceForecast } from "./types";
import { dayAt, hourAt, nextGlowEvent, sunAltitudeAt } from "./selectors";

export interface PlaceSummary {
  timezone: string;
  sunAltitude: number | null;
  cloud: number | null;
  sunrise: number | null;
  sunset: number | null;
  nextEvent: Pick<GlowEvent, "kind" | "date" | "time" | "score" | "level"> | null;
}

export function summarizePlace(forecast: PlaceForecast, now: number): PlaceSummary {
  const event = nextGlowEvent(forecast.events, now);
  const today = dayAt(forecast.days, now);
  return {
    timezone: forecast.timezone,
    sunAltitude: sunAltitudeAt(forecast.days, now),
    cloud: hourAt(forecast.hours, now)?.cloud ?? null,
    sunrise: today?.sunrise ?? null,
    sunset: today?.sunset ?? null,
    nextEvent: event && {
      kind: event.kind,
      date: event.date,
      time: event.time,
      score: event.score,
      level: event.level,
    },
  };
}
