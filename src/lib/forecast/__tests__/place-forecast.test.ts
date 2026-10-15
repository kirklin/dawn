import type { PlaceForecast } from "../types";
import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "~/lib/time/zoned";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "../models";
import { getPlaceForecast } from "../place-forecast";

/** The rated glows run without a gap from the first sunrise until a model's run ends. */
function expectRatedFromTheStart(forecast: PlaceForecast, days: number) {
  const crossings = forecast.days.flatMap(day =>
    (["sunrise", "sunset"] as const).flatMap(kind => day[kind] === null ? [] : [`${day.date} ${kind}`]));
  const rated = forecast.events.map(event => `${event.date} ${event.kind}`);
  expect(rated).toEqual(crossings.slice(0, rated.length));
  expect(rated.length).toBeGreaterThanOrEqual(days * 2);
}

function expectHourly(times: number[], start: number) {
  expect(times.every((time, index) => time === start + index * HOUR_MS)).toBe(true);
}

// Calls the live Open-Meteo APIs.
describe("getPlaceForecast", () => {
  it("assembles glow events, hours and sun days for Guangzhou", async () => {
    const now = Date.now();
    const forecast = await getPlaceForecast({ lat: 23.1405, lon: 113.3275 }, now);

    expect(forecast.timezone).toBe("Asia/Shanghai");
    expect(forecast.days).toHaveLength(FORECAST_DAYS);
    // ECMWF runs out about fifteen days after it starts, so the last day or so has GFS alone and no rated glow.
    expectRatedFromTheStart(forecast, FORECAST_DAYS - 2);
    expectHourly(forecast.hours.map(hour => hour.time), forecast.days[0].start);
    expect(forecast.hours.length).toBeGreaterThanOrEqual((FORECAST_DAYS - 1) * 24);
    expect(forecast.hours.length).toBeLessThanOrEqual(FORECAST_DAYS * 24);

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

    // The sky can be shown from the start of the first day to the last hour a model reaches, past every rated glow.
    for (const track of [forecast.tracks.sunrise, forecast.tracks.sunset]) {
      expect(track).toBeDefined();
      expectHourly(track!.hours.map(hour => hour.time), forecast.days[0].start);
      expect(track!.hours.at(-1)!.time).toBeGreaterThan(forecast.events.at(-1)!.time);
      expect(track!.hours.at(-1)!.time).toBeLessThanOrEqual(forecast.days.at(-1)!.end);
      for (const hour of track!.hours) {
        expect(hour.cover).toHaveLength(PATH_DISTANCES_KM.length);
        expect(hour.transmission).toBeGreaterThanOrEqual(0);
        expect(hour.transmission).toBeLessThanOrEqual(1);
      }
    }

    // CAMS runs about five days, so later glows have no aerosol forecast.
    expect(forecast.events[0].aod).not.toBeNull();
    expect(forecast.events.at(-1)!.aod).toBeNull();

    for (const run of Object.values(forecast.runs)) {
      expect(now - run).toBeLessThan(2 * 24 * 3600_000);
    }
  }, 60_000);

  it("starts the days with a response from the day before, as a cached one after midnight is", async () => {
    // Open-Meteo answers from its own today, so asking as if it were tomorrow gets a response a day old.
    const forecast = await getPlaceForecast({ lat: 23.1405, lon: 113.3275 }, Date.now() + DAY_MS);
    expectRatedFromTheStart(forecast, FORECAST_DAYS - 3);
    expect(forecast.hours[0].time).toBe(forecast.days[0].start);
    expectHourly(forecast.hours.map(hour => hour.time), forecast.days[0].start);
  }, 60_000);
});
