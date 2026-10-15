import { describe, expect, it } from "vitest";
import { HOUR_MS } from "~/lib/time/zoned";
import { EXAMPLE_PLACE, getExampleForecast } from "../example";
import { FORECAST_DAYS } from "../models";
import { GLOW_LINGER_MS } from "../selectors";

describe("getExampleForecast", () => {
  const moments = [
    "2026-10-16T03:00:00+08:00",
    "2026-10-16T09:30:00+08:00",
    "2026-10-16T17:50:00+08:00",
    "2026-10-16T18:15:00+08:00",
    "2026-10-16T22:00:00+08:00",
    "2027-06-21T12:00:00+08:00",
  ];

  for (const moment of moments) {
    it(`opens on a large glow at ${moment}`, () => {
      const now = Date.parse(moment);
      const forecast = getExampleForecast(now);
      const upcoming = forecast.events.filter(event => event.time + GLOW_LINGER_MS > now);

      expect(upcoming[0].level).toBe("large");
      // The rest are plainer, so the large one stands out, and span the other levels.
      expect(upcoming.slice(1).some(event => event.level === "large" || event.level === "epic")).toBe(false);
      expect(new Set(upcoming.map(event => event.level))).toEqual(new Set(["large", "medium", "small", "faint", "none"]));
    });
  }

  it("covers every day and hour of the forecast like a real one", () => {
    const now = Date.parse("2026-10-16T09:30:00+08:00");
    const forecast = getExampleForecast(now);

    expect(forecast.lat).toBeCloseTo(EXAMPLE_PLACE.lat, 2);
    expect(forecast.timezone).toBe("Asia/Shanghai");
    expect(forecast.runs).toBeNull();
    expect(forecast.days).toHaveLength(FORECAST_DAYS);
    expect(forecast.events).toHaveLength(FORECAST_DAYS * 2);
    expect(forecast.hours).toHaveLength(FORECAST_DAYS * 24);
    for (const track of [forecast.tracks.sunrise, forecast.tracks.sunset]) {
      expect(track!.hours[0].time).toBe(forecast.days[0].start);
      expect(track!.hours.at(-1)!.time).toBe(forecast.days.at(-1)!.end);
      expect(track!.hours[1].time - track!.hours[0].time).toBe(HOUR_MS);
    }
  });
});
