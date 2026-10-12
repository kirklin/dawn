import { describe, expect, it } from "vitest";
import { DAY_MS } from "~/lib/time/zoned";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "../models";
import { getPlaceForecast } from "../place-forecast";

// Calls the live Open-Meteo APIs.
describe("getPlaceForecast", () => {
  it("assembles glow events, hours and sun days for Guangzhou", async () => {
    const now = Date.now();
    const forecast = await getPlaceForecast({ lat: 23.1405, lon: 113.3275 }, now);

    expect(forecast.timezone).toBe("Asia/Shanghai");
    expect(forecast.days).toHaveLength(FORECAST_DAYS);
    expect(forecast.hours).toHaveLength(FORECAST_DAYS * 24);
    expect(forecast.events).toHaveLength(FORECAST_DAYS * 2);

    for (const event of forecast.events) {
      expect(event.score).toBeGreaterThanOrEqual(0);
      expect(event.score).toBeLessThanOrEqual(1);
      for (const model of MODEL_IDS) {
        expect(event.models[model].section).toHaveLength(PATH_DISTANCES_KM.length);
      }
      for (const wind of Object.values(event.wind)) {
        expect(Math.hypot(wind.east, wind.north)).toBeLessThan(120);
      }
    }

    const sunsets = forecast.events.filter(event => event.kind === "sunset");
    expect(sunsets.every(event => event.azimuth > 240 && event.azimuth < 270)).toBe(true);

    // The sky can be shown at any moment of the four days, through the hour that ends them.
    for (const track of [forecast.tracks.sunrise, forecast.tracks.sunset]) {
      expect(track).toBeDefined();
      expect(track!.hours[0].time).toBe(forecast.days[0].start);
      expect(track!.hours.at(-1)!.time).toBe(forecast.days.at(-1)!.end);
      for (const hour of track!.hours) {
        expect(hour.cover).toHaveLength(PATH_DISTANCES_KM.length);
        expect(hour.transmission).toBeGreaterThanOrEqual(0);
        expect(hour.transmission).toBeLessThanOrEqual(1);
      }
    }

    for (const run of Object.values(forecast.runs)) {
      expect(now - run).toBeLessThan(2 * 24 * 3600_000);
    }
  }, 60_000);

  it("covers all four days with a response that starts the day before, as a cached one does after midnight", async () => {
    // Open-Meteo answers from its own today, so asking as if it were tomorrow gets a response a day old.
    const forecast = await getPlaceForecast({ lat: 23.1405, lon: 113.3275 }, Date.now() + DAY_MS);
    expect(forecast.events).toHaveLength(FORECAST_DAYS * 2);
    expect(forecast.hours).toHaveLength(FORECAST_DAYS * 24);
    expect(forecast.hours[0].time).toBe(forecast.days[0].start);
  }, 60_000);
});
