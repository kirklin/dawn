import type { GlowEvent } from "../types";
import type { MoonQuarterEvent } from "~/lib/astro/moon";
import { describe, expect, it } from "vitest";
import { createObserver, sunDay } from "~/lib/astro/sun";
import { HOUR_MS, MINUTE_MS, zonedMidnight } from "~/lib/time/zoned";
import { daysUntilQuarter, lightPhaseAt, lightPhases, nearestEvent, nextMoonCrossing, nextSunCrossing, solarNoon, sunAltitudeAt, sunAzimuthAt, sunPathRange } from "../selectors";

const SHANGHAI = "Asia/Shanghai";
const observer = createObserver(23.14, 113.32, 20);
const days = ["2026-10-12", "2026-10-13"].map(date => sunDay(observer, date, SHANGHAI));
const noon = zonedMidnight("2026-10-12", SHANGHAI) + 12 * HOUR_MS;

describe("sun selectors", () => {
  it("interpolates the sun's altitude, high at noon and negative at midnight", () => {
    expect(sunAltitudeAt(days, noon)).toBeGreaterThan(55);
    expect(sunAltitudeAt(days, days[0].start)).toBeLessThan(-50);
    expect(sunAltitudeAt(days, days[1].end + HOUR_MS)).toBeNull();
  });

  it("follows the sun's azimuth from east through south to west, and finds noon", () => {
    expect(sunAzimuthAt(days, days[0].sunrise!)).toBeCloseTo(days[0].sunriseAzimuth!, 0);
    expect(sunAzimuthAt(days, days[0].sunset!)).toBeCloseTo(days[0].sunsetAzimuth!, 0);
    expect(Math.abs(sunAzimuthAt(days, solarNoon(days[0]))! - 180)).toBeLessThan(15);
    expect(Math.abs(solarNoon(days[0]) - noon)).toBeLessThan(40 * MINUTE_MS);
  });

  it("lists the light around sunrise blue first, and around sunset golden first", () => {
    const morning = lightPhases({ kind: "sunrise", date: "2026-10-13" }, days);
    expect(morning.map(phase => phase.kind)).toEqual(["blue", "golden"]);
    expect(morning[0].range[1]).toBe(morning[1].range[0]);
    expect(morning[0].range[0]).toBe(days[1].blueMorning?.[0]);

    const evening = lightPhases({ kind: "sunset", date: "2026-10-12" }, days);
    expect(evening.map(phase => phase.kind)).toEqual(["golden", "blue"]);
    expect(evening[1].range[1]).toBe(days[0].blueEvening?.[1]);
  });

  it("leaves out the phases the sun never reaches", () => {
    const polar = [sunDay(createObserver(69.65, 18.96, 0), "2026-12-20", "Europe/Oslo")];
    expect(lightPhases({ kind: "sunset", date: "2026-12-20" }, polar).every(phase => phase.kind === "blue")).toBe(true);
  });

  it("shows the sun path from two hours before sunrise to two hours after sunset, and keeps the present in it", () => {
    const [today, tomorrow] = days;
    expect(sunPathRange(today, noon)).toEqual([today.sunrise! - 2 * HOUR_MS, today.sunset! + 2 * HOUR_MS]);
    expect(sunPathRange(tomorrow, noon)).toEqual([tomorrow.sunrise! - 2 * HOUR_MS, tomorrow.sunset! + 2 * HOUR_MS]);

    const lateEvening = today.end - HOUR_MS;
    expect(sunPathRange(today, lateEvening)).toEqual([today.sunrise! - 2 * HOUR_MS, lateEvening + 30 * MINUTE_MS]);
    expect(sunPathRange(today, today.end - 10 * MINUTE_MS)[1]).toBe(today.end);
    expect(sunPathRange(today, today.start + HOUR_MS)[0]).toBe(today.start + 30 * MINUTE_MS);
  });

  it("shows the whole day where the sun does not rise and set", () => {
    const polarNight = sunDay(createObserver(78.22, 15.65, 0), "2026-12-20", "Arctic/Longyearbyen");
    expect(polarNight.sunrise).toBeNull();
    expect(sunPathRange(polarNight, noon)).toEqual([polarNight.start, polarNight.end]);
  });

  it("finds the coming sunset at noon and the next sunrise after dark", () => {
    expect(nextSunCrossing(days, noon)).toEqual({ kind: "sunset", time: days[0].sunset });
    expect(nextSunCrossing(days, days[0].sunset! + MINUTE_MS)).toEqual({ kind: "sunrise", time: days[1].sunrise });
    expect(nextSunCrossing(days, days[1].sunset! + MINUTE_MS)).toBeNull();
  });

  it("names the light by the sun's altitude", () => {
    expect(lightPhaseAt(30)).toBe("day");
    expect(lightPhaseAt(2)).toBe("golden");
    expect(lightPhaseAt(-5)).toBe("blue");
    expect(lightPhaseAt(-20)).toBe("night");
    expect(lightPhaseAt(sunAltitudeAt(days, days[0].sunset!)!)).toBe("golden");
  });
});

describe("nearestEvent", () => {
  it("picks the sunrise or sunset closest to a moment", () => {
    const events = [
      { kind: "sunset", time: days[0].sunset! },
      { kind: "sunrise", time: days[1].sunrise! },
    ] as GlowEvent[];
    expect(nearestEvent(events, days[0].sunset! + 2 * HOUR_MS)).toBe(events[0]);
    expect(nearestEvent(events, days[1].sunrise! - 2 * HOUR_MS)).toBe(events[1]);
    expect(nearestEvent([], noon)).toBeNull();
  });
});

describe("moon selectors", () => {
  it("returns whichever of moonrise and moonset comes first after now", () => {
    expect(nextMoonCrossing({ nextRise: noon + HOUR_MS, nextSet: noon + 2 * HOUR_MS }, noon)).toEqual({ kind: "moonrise", time: noon + HOUR_MS });
    expect(nextMoonCrossing({ nextRise: noon - HOUR_MS, nextSet: noon + 2 * HOUR_MS }, noon)).toEqual({ kind: "moonset", time: noon + 2 * HOUR_MS });
    expect(nextMoonCrossing({ nextRise: null, nextSet: null }, noon)).toBeNull();
  });

  it("counts calendar days to the next full moon in the place's time zone", () => {
    const quarters: MoonQuarterEvent[] = [
      { quarter: "firstQuarter", time: zonedMidnight("2026-10-19", SHANGHAI) + 13 * MINUTE_MS },
      { quarter: "full", time: zonedMidnight("2026-10-26", SHANGHAI) + 12 * HOUR_MS },
    ];
    expect(daysUntilQuarter(quarters, "full", noon, SHANGHAI)).toBe(14);
    expect(daysUntilQuarter(quarters, "full", zonedMidnight("2026-10-26", SHANGHAI) + 20 * HOUR_MS, SHANGHAI)).toBe(0);
    expect(daysUntilQuarter(quarters, "new", noon, SHANGHAI)).toBeNull();
  });
});
