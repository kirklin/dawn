import { describe, expect, it } from "vitest";
import { HOUR_MS } from "~/lib/time/zoned";
import { modelSeries } from "../open-meteo";
import { valueAt } from "../series";

const time = [0, HOUR_MS, 2 * HOUR_MS, 3 * HOUR_MS];

describe("valueAt", () => {
  it("interpolates between hours", () => {
    expect(valueAt(time, [0, 10, 20, 30], 1.5 * HOUR_MS)).toBe(15);
  });

  it("reads the last hour of a run on the dot, and nothing past it", () => {
    const values = [0, 10, null, null];
    expect(valueAt(time, values, HOUR_MS)).toBe(10);
    expect(valueAt(time, values, 1.5 * HOUR_MS)).toBeNull();
    expect(valueAt(time, values, 2 * HOUR_MS)).toBeNull();
  });

  it("has nothing outside the series", () => {
    expect(valueAt(time, [0, 10, 20, 30], -1)).toBeNull();
    expect(valueAt(time, [0, 10, 20, 30], 3 * HOUR_MS + 1)).toBeNull();
  });
});

describe("modelSeries", () => {
  it("keeps the nulls past the end of a model's run", () => {
    expect(modelSeries({ time: [0, 1, 2], cloud_cover: [40, 50, null] }, "cloud_cover")).toEqual([40, 50, null]);
  });

  it("rejects a gap before the end of the run", () => {
    expect(() => modelSeries({ time: [0, 1, 2], cloud_cover: [40, null, 50] }, "cloud_cover")).toThrow("for hour 1");
  });

  it("rejects a series with no values or none at all", () => {
    expect(() => modelSeries({ time: [0, 1], cloud_cover: [null, null] }, "cloud_cover")).toThrow("no cloud_cover");
    expect(() => modelSeries({ time: [0, 1] }, "cloud_cover")).toThrow("missing cloud_cover");
  });
});
