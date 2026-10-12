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
    ["firstLight", "05:59"],
    ["sunrise", "06:22"],
    ["sunset", "18:04"],
    ["lastLight", "18:26"],
  ] as const)("matches Apple Weather's %s within a minute", (key, expected) => {
    expect(Math.abs(minutes(clock(day[key])) - minutes(expected))).toBeLessThanOrEqual(1);
  });

  it("orders the twilight and light phases through the day", () => {
    const sequence = [
      day.astronomicalDawn,
      day.nauticalDawn,
      day.firstLight,
      day.sunrise,
      day.solarNoon,
      day.sunset,
      day.lastLight,
      day.nauticalDusk,
      day.astronomicalDusk,
    ];
    expect(sequence.every(time => time !== null)).toBe(true);
    expect([...sequence].sort((a, b) => a! - b!)).toEqual(sequence);
    expect(day.blueMorning?.[1]).toBe(day.goldenMorning?.[0]);
    expect(day.goldenEvening?.[1]).toBe(day.blueEvening?.[0]);
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
