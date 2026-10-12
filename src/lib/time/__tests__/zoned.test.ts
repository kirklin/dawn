import { describe, expect, it } from "vitest";
import { addDays, daysBetween, zonedDateKey, zonedMidnight } from "../zoned";

describe("zoned time", () => {
  it("finds local midnight in a fixed-offset zone", () => {
    expect(zonedMidnight("2026-10-12", "Asia/Shanghai")).toBe(Date.UTC(2026, 9, 11, 16));
  });

  it("finds local midnight on daylight saving days", () => {
    expect(zonedMidnight("2026-03-08", "America/New_York")).toBe(Date.UTC(2026, 2, 8, 5));
    expect(zonedMidnight("2026-03-09", "America/New_York")).toBe(Date.UTC(2026, 2, 9, 4));
  });

  it("reads the local date and time of an instant", () => {
    const instant = Date.UTC(2026, 9, 11, 16, 30);
    expect(zonedDateKey(instant, "Asia/Shanghai")).toBe("2026-10-12");
    expect(zonedDateKey(instant, "Europe/London")).toBe("2026-10-11");
  });

  it("steps and counts calendar days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-12", "2026-10-26")).toBe(14);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-10-12", "2026-10-12")).toBe(0);
  });
});
