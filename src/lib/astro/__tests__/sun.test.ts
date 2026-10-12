import { describe, expect, it } from "vitest";
import { formatClock } from "~/lib/format";
import { createObserver, sunDay } from "../sun";

const SHANGHAI = "Asia/Shanghai";

describe("sunDay", () => {
  // Apple Weather for Tianhe, Guangzhou on 2026-10-12 lists first light 5:59, sunrise 6:22,
  // sunset 18:04 and last light 18:26.
  const day = sunDay(createObserver(23.14, 113.32, 20), "2026-10-12", SHANGHAI);
  const clock = (time: number | null) => (time === null ? null : formatClock(time, SHANGHAI));
  const minutes = (text: string | null) => {
    if (text === null) {
      throw new Error("Expected a time");
    }
    const [hours, rest] = text.split(":").map(Number);
    return hours * 60 + rest;
  };

  it.each([
    ["first light, where the blue hour begins", day.blueMorning?.[0] ?? null, "05:59"],
    ["sunrise", day.sunrise, "06:22"],
    ["sunset", day.sunset, "18:04"],
    ["last light, where the blue hour ends", day.blueEvening?.[1] ?? null, "18:26"],
  ] as const)("matches Apple Weather's %s within a minute", (_, time, expected) => {
    expect(Math.abs(minutes(clock(time)) - minutes(expected))).toBeLessThanOrEqual(1);
  });

  it("puts the blue and golden hours around sunrise and sunset in order", () => {
    const { blueMorning, goldenMorning, goldenEvening, blueEvening, sunrise, sunset } = day;
    if (!blueMorning || !goldenMorning || !goldenEvening || !blueEvening || sunrise === null || sunset === null) {
      throw new Error("Guangzhou in October has every light phase");
    }
    expect(blueMorning[1]).toBe(goldenMorning[0]);
    expect(sunrise).toBeGreaterThan(goldenMorning[0]);
    expect(sunrise).toBeLessThan(goldenMorning[1]);
    expect(sunset).toBeGreaterThan(goldenEvening[0]);
    expect(sunset).toBeLessThan(goldenEvening[1]);
    expect(goldenEvening[1]).toBe(blueEvening[0]);
  });

  it("puts the October sun south of due east and west", () => {
    expect(day.sunriseAzimuth).toBeGreaterThan(90);
    expect(day.sunriseAzimuth).toBeLessThan(105);
    expect(day.sunsetAzimuth).toBeGreaterThan(255);
    expect(day.sunsetAzimuth).toBeLessThan(270);
  });

  it("samples the altitude curve across the whole local day", () => {
    expect(day.altitudes).toHaveLength(24 * 6 + 1);
    expect(Math.max(...day.altitudes)).toBeGreaterThan(55);
    expect(Math.min(...day.altitudes)).toBeLessThan(-55);
  });

  it("has no sunrise or sunset in the polar night", () => {
    const polar = sunDay(createObserver(69.65, 18.96, 0), "2026-12-20", "Europe/Oslo");
    expect(polar.sunrise).toBeNull();
    expect(polar.sunset).toBeNull();
    expect(polar.altitudes.every(altitude => altitude < 0)).toBe(true);
  });
});
