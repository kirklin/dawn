import type { GlowEvent, PlaceForecast } from "./types";
import { hourAt, nextGlowEvent, sunAltitudeAt } from "./selectors";

/** What the place list shows for a place: its sky now, for the cell's colour, and the next glow. */
export interface PlaceSummary {
  timezone: string;
  sunAltitude: number | null;
  cloud: number | null;
  nextEvent: Pick<GlowEvent, "kind" | "date" | "time" | "score" | "level"> | null;
}

export function summarizePlace(forecast: PlaceForecast, now: number): PlaceSummary {
  const event = nextGlowEvent(forecast.events, now);
  return {
    timezone: forecast.timezone,
    sunAltitude: sunAltitudeAt(forecast.days, now),
    cloud: hourAt(forecast.hours, now)?.cloud ?? null,
    nextEvent: event && {
      kind: event.kind,
      date: event.date,
      time: event.time,
      score: event.score,
      level: event.level,
    },
  };
}
