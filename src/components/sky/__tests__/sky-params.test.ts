import type { SkyHour, SkyTrack } from "~/lib/forecast/types";
import { describe, expect, it } from "vitest";
import { createObserver, sunDay } from "~/lib/astro/sun";
import { PATH_DISTANCES_KM } from "~/lib/forecast/models";
import { solarNoon, sunAltitudeAt } from "~/lib/forecast/selectors";
import { HOUR_MS, MINUTE_MS } from "~/lib/time/zoned";
import { blendSkyParams, glowMoment, skyParamsAt, viewWind } from "../sky-params";

const DEG = 180 / Math.PI;
const days = ["2026-10-12", "2026-10-13"].map(date => sunDay(createObserver(23.12, 113.25, 20), date, "Asia/Shanghai"));
const [today, tomorrow] = days;

function hour(time: number, mid: number, wind: SkyHour["wind"]): SkyHour {
  return {
    time,
    cover: PATH_DISTANCES_KM.map(() => [0.1, mid, 0.2]),
    transmission: 0.8,
    aod: 0.3,
    wet: 0,
    wind,
  };
}

/** Hourly track over both days; mid cloud steps through `mid(hourIndex)`. */
function track(azimuth: number, mid: (index: number) => number, wind: SkyHour["wind"]): SkyTrack {
  return {
    azimuth,
    hours: Array.from({ length: 49 }, (_, index) => hour(today.start + index * HOUR_MS, mid(index), wind)),
  };
}

// A westerly jet over a calm lower atmosphere.
const westerly = { low: { east: 0, north: 2 }, mid: { east: 8, north: 0 }, high: { east: 30, north: 0 } };
const forecast = {
  days,
  lat: 23.12,
  lon: 113.25,
  tracks: {
    sunrise: track(98, () => 0.9, westerly),
    sunset: track(262, index => index / 100, westerly),
  },
};

describe("skyParamsAt", () => {
  it("shows a glow a few minutes after sunset and before sunrise, with the sun just under the horizon", () => {
    for (const time of [glowMoment({ kind: "sunset", time: today.sunset! }), glowMoment({ kind: "sunrise", time: tomorrow.sunrise! })]) {
      const { sun } = skyParamsAt(forecast, time);
      expect(sun * DEG).toBeLessThan(-0.3);
      expect(sun * DEG).toBeGreaterThan(-1.6);
    }
  });

  it("looks toward the sunrise while the sun is low in the morning, and toward the sunset as it sinks in the evening", () => {
    expect(skyParamsAt(forecast, today.sunrise! + 15 * MINUTE_MS).cover[0][1]).toBeCloseTo(0.9);
    expect(skyParamsAt(forecast, today.sunset! - 15 * MINUTE_MS).cover[0][1]).toBeLessThan(0.5);
  });

  it("keeps the sun out of view once it has climbed", () => {
    for (let time = today.sunrise!; time < today.sunset!; time += 10 * MINUTE_MS) {
      if (sunAltitudeAt(days, time)! >= 15) {
        expect(Math.abs(skyParamsAt(forecast, time).sunAzimuth * DEG)).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it("interpolates the forecast between hours and holds it past the last one", () => {
    const halfPast = today.start + 18 * HOUR_MS + 30 * MINUTE_MS;
    expect(skyParamsAt(forecast, halfPast).cover[3][1]).toBeCloseTo(0.185);

    // A response cached the day before ends a few hours short of the last forecast day.
    const short = { ...forecast.tracks.sunset, hours: forecast.tracks.sunset.hours.slice(0, 43) };
    const evening = skyParamsAt({ ...forecast, tracks: { ...forecast.tracks, sunset: short } }, tomorrow.end - MINUTE_MS);
    expect(evening.cover[0][1]).toBeCloseTo(0.42);
  });

  it("brings westerly clouds toward a sunset watcher and carries them off toward a sunrise", () => {
    const evening = skyParamsAt(forecast, today.sunset!);
    const morning = skyParamsAt(forecast, tomorrow.sunrise!);
    expect(evening.wind[2][1]).toBeCloseTo(-30 * Math.cos((262 - 270) * Math.PI / 180));
    expect(morning.wind[2][1]).toBeCloseTo(30 * Math.cos((98 - 90) * Math.PI / 180));
    // Facing west, a southerly wind blows to the watcher's right.
    expect(evening.wind[0][0]).toBeGreaterThan(1.9);
  });

  it("faces the sun as it sets or rises, and turns away from it at noon", () => {
    const sunset = skyParamsAt(forecast, today.sunset!);
    const sunrise = skyParamsAt(forecast, tomorrow.sunrise!);
    const noon = skyParamsAt(forecast, solarNoon(today));
    expect(Math.abs(sunset.sunAzimuth * DEG)).toBeLessThan(5);
    expect(Math.abs(sunrise.sunAzimuth * DEG)).toBeLessThan(5);
    expect(Math.abs(noon.sunAzimuth * DEG)).toBeGreaterThan(150);
  });

  it("turns the view through the day without a jump", () => {
    // Flipping from the sunrise view to the sunset view at once would swing the sun by about 160°.
    let previous = skyParamsAt(forecast, today.sunrise!).sunAzimuth;
    for (let time = today.sunrise! + 10 * MINUTE_MS; time < today.sunset!; time += 10 * MINUTE_MS) {
      const { sunAzimuth } = skyParamsAt(forecast, time);
      const step = Math.atan2(Math.sin(sunAzimuth - previous), Math.cos(sunAzimuth - previous));
      expect(Math.abs(step * DEG)).toBeLessThan(30);
      previous = sunAzimuth;
    }
  });

  it("keeps the same cloud seed at every moment of a place", () => {
    expect(skyParamsAt(forecast, today.sunrise!).seed).toEqual(skyParamsAt(forecast, tomorrow.sunset!).seed);
  });

  it("shows a clear sky where the sun neither rises nor sets", () => {
    const params = skyParamsAt({ ...forecast, tracks: {} }, today.start + 12 * HOUR_MS);
    expect(params.cover.every(layers => layers.every(value => value === 0))).toBe(true);
  });
});

describe("viewWind", () => {
  it("measures the wind to the right of and along the facing direction", () => {
    const north = { east: 0, north: 5 };
    expect(viewWind(north, 0)[0]).toBeCloseTo(0);
    expect(viewWind(north, 0)[1]).toBeCloseTo(5);
    expect(viewWind(north, 90)[0]).toBeCloseTo(-5);
    expect(viewWind(north, 90)[1]).toBeCloseTo(0);
    expect(viewWind({ east: 3, north: 0 }, 180)[0]).toBeCloseTo(-3);
  });
});

describe("blendSkyParams", () => {
  it("morphs every value linearly between two skies", () => {
    const from = skyParamsAt(forecast, today.sunrise!);
    const to = skyParamsAt(forecast, today.sunset!);
    const half = blendSkyParams(from, to, 0.5);
    expect(half.cover[0][1]).toBeCloseTo((from.cover[0][1] + to.cover[0][1]) / 2);
    expect(half.sun).toBeCloseTo((from.sun + to.sun) / 2);
    const end = blendSkyParams(from, to, 1);
    expect(end.cover[0][1]).toBeCloseTo(to.cover[0][1]);
    expect(end.wind[2][1]).toBeCloseTo(to.wind[2][1]);
    expect(end.seed).toEqual(to.seed);
  });
});
