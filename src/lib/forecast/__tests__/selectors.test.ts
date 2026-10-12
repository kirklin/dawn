import type { MoonQuarterEvent } from "~/lib/astro/moon";
import { describe, expect, it } from "vitest";
import { createObserver, sunDay } from "~/lib/astro/sun";
import { HOUR_MS, MINUTE_MS, zonedMidnight } from "~/lib/time/zoned";
import { daysUntilQuarter, nextLightSession, nextMoonCrossing, nextSunCrossing, sunAltitudeAt } from "../selectors";

const SHANGHAI = "Asia/Shanghai";
const observer = createObserver(23.14, 113.32, 20);
const days = ["2026-10-12", "2026-10-13"].map(date => sunDay(observer, date, SHANGHAI));
const noon = zonedMidnight("2026-10-12", SHANGHAI) + 12 * HOUR_MS;

describe("sun selectors", () => {
  it("picks the coming sunset at noon and the next sunrise after dark", () => {
    expect(nextSunCrossing(days, noon)).toMatchObject({ kind: "sunset", time: days[0].sunset });
    expect(nextSunCrossing(days, days[0].sunset! + MINUTE_MS)).toMatchObject({ kind: "sunrise", time: days[1].sunrise });
  });

  it("interpolates the sun's altitude, high at noon and negative at midnight", () => {
    expect(sunAltitudeAt(days, noon)).toBeGreaterThan(55);
    expect(sunAltitudeAt(days, days[0].start)).toBeLessThan(-50);
    expect(sunAltitudeAt(days, days[1].end + HOUR_MS)).toBeNull();
  });

  it("offers the evening light session after noon and tomorrow's morning after dusk", () => {
    const evening = nextLightSession(days, noon);
    expect(evening?.period).toBe("evening");
    expect(evening?.start).toBe(days[0].goldenEvening?.[0]);
    expect(evening?.end).toBe(days[0].blueEvening?.[1]);

    const morning = nextLightSession(days, days[0].lastLight! + MINUTE_MS);
    expect(morning?.period).toBe("morning");
    expect(morning?.start).toBe(days[1].blueMorning?.[0]);
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
