import { describe, expect, it } from "vitest";
import { moonPhaseName, moonState, upcomingQuarters } from "../moon";

describe("moonPhaseName", () => {
  it.each([
    [0, "new"],
    [5, "new"],
    [45, "waxingCrescent"],
    [93, "firstQuarter"],
    [130, "waxingGibbous"],
    [182, "full"],
    [220, "waningGibbous"],
    [266, "thirdQuarter"],
    [300, "waningCrescent"],
    [356, "new"],
    [-90, "thirdQuarter"],
  ])("names elongation %d° %s", (angle, name) => {
    expect(moonPhaseName(angle)).toBe(name);
  });
});

describe("moon quarters", () => {
  it("finds the October 2026 full moon and lights the whole disc then", () => {
    const quarters = upcomingQuarters(Date.UTC(2026, 9, 12), 4);
    expect(quarters.map(quarter => quarter.quarter)).toEqual(["firstQuarter", "full", "thirdQuarter", "new"]);

    const full = quarters[1];
    expect(new Date(full.time).toISOString().slice(0, 10)).toBe("2026-10-26");
    const state = moonState(full.time);
    expect(state.phase).toBe("full");
    expect(state.illumination).toBeGreaterThan(0.99);
  });
});
