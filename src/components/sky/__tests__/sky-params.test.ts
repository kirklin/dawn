import type { GlowEvent, GlowModelResult } from "~/lib/forecast/types";
import { describe, expect, it } from "vitest";
import { createObserver, sunDay } from "~/lib/astro/sun";
import { PATH_DISTANCES_KM } from "~/lib/forecast/models";
import { blendSkyParams, quietSkyParams, skyParams, viewWind } from "../sky-params";

const DEG = 180 / Math.PI;
const days = ["2026-10-12", "2026-10-13"].map(date => sunDay(createObserver(23.12, 113.25, 20), date, "Asia/Shanghai"));

function model(low: number, mid: number, high: number, transmission: number): GlowModelResult {
  return {
    score: 0.3,
    section: PATH_DISTANCES_KM.map(km => ({ low: km >= 150 ? low * 2 : low, mid, high })),
    factors: { canvasCover: mid, canvas: mid, transmission, view: 1, aod: 0.3, aerosol: 0.8, rain: 0.9 },
  };
}

function event(kind: "sunrise" | "sunset", dayIndex: number): GlowEvent {
  const day = days[dayIndex];
  const time = kind === "sunset" ? day.sunset! : day.sunrise!;
  return {
    kind,
    date: day.date,
    time,
    scoredAt: time,
    azimuth: kind === "sunset" ? 262 : 98,
    score: 0.3,
    level: "small",
    spread: 0.2,
    aod: 0.3,
    // A westerly jet over a calm lower atmosphere.
    wind: { low: { east: 0, north: 2 }, mid: { east: 8, north: 0 }, high: { east: 30, north: 0 } },
    models: { ecmwf: model(0.1, 0.4, 0.2, 0.8), gfs: model(0.3, 0.6, 0, 0.6) },
  };
}

const forecast = { days, lat: 23.12, lon: 113.25 };

describe("skyParams", () => {
  it("paints the sky a few minutes after sunset, with the sun just under the horizon", () => {
    const params = skyParams(event("sunset", 0), forecast);
    expect(params.sun * DEG).toBeLessThan(-0.3);
    expect(params.sun * DEG).toBeGreaterThan(-1.6);
  });

  it("paints the sky a few minutes before sunrise", () => {
    const params = skyParams(event("sunrise", 1), forecast);
    expect(params.sun * DEG).toBeLessThan(-0.3);
    expect(params.sun * DEG).toBeGreaterThan(-1.6);
  });

  it("averages the cloud models along the path toward the sun", () => {
    const params = skyParams(event("sunset", 0), forecast);
    expect(params.cover).toHaveLength(PATH_DISTANCES_KM.length);
    expect(params.cover[0][0]).toBeCloseTo(0.2);
    expect(params.cover[0][1]).toBeCloseTo(0.5);
    expect(params.cover[0][2]).toBeCloseTo(0.1);
    expect(params.cover[PATH_DISTANCES_KM.indexOf(300)][0]).toBeCloseTo(0.4);
    expect(params.transmission).toBeCloseTo(0.7);
    expect(params.wet).toBeCloseTo(0.1);
    expect(params.aod).toBe(0.3);
  });

  it("keeps the same cloud seed for every event of a place", () => {
    expect(skyParams(event("sunset", 0), forecast).seed).toEqual(skyParams(event("sunrise", 1), forecast).seed);
  });

  it("brings westerly clouds toward a sunset watcher and carries them off toward a sunrise", () => {
    const sunset = skyParams(event("sunset", 0), forecast);
    const sunrise = skyParams(event("sunrise", 1), forecast);
    expect(sunset.wind[2][1]).toBeCloseTo(-30 * Math.cos((262 - 270) * Math.PI / 180));
    expect(sunrise.wind[2][1]).toBeCloseTo(30 * Math.cos((98 - 90) * Math.PI / 180));
    // Facing west, a southerly wind blows to the watcher's right.
    expect(sunset.wind[0][0]).toBeGreaterThan(1.9);
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
    const from = quietSkyParams(23.12, 113.25);
    const to = skyParams(event("sunset", 0), forecast);
    const half = blendSkyParams(from, to, 0.5);
    expect(half.cover[0][1]).toBeCloseTo(to.cover[0][1] / 2);
    expect(half.transmission).toBeCloseTo((from.transmission + to.transmission) / 2);
    expect(blendSkyParams(from, to, 1)).toEqual({ ...to, cover: to.cover.map(layers => [...layers]) });
  });
});
