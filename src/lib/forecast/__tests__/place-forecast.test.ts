import { describe, expect, it } from "vitest";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "../models";
import { getPlaceForecast, placeSunYear } from "../place-forecast";

// Calls the live Open-Meteo APIs.
describe("getPlaceForecast", () => {
  it("assembles glow events, hours and astronomy for Guangzhou", async () => {
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
    }

    const sunsets = forecast.events.filter(event => event.kind === "sunset");
    expect(sunsets.every(event => event.azimuth > 240 && event.azimuth < 270)).toBe(true);

    for (const run of Object.values(forecast.runs)) {
      expect(now - run).toBeLessThan(2 * 24 * 3600_000);
    }
    const year = placeSunYear(forecast, now);
    expect(year.months).toHaveLength(12);
    expect(year.months.every(month => month.sunrise !== null && month.sunset !== null)).toBe(true);
    expect(year.longestDay?.date.slice(5, 7)).toBe("06");
  }, 60_000);
});
