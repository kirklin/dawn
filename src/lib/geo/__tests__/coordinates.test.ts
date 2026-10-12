import { describe, expect, it } from "vitest";
import { compassPoint, destinationPoint, distanceKm, normalizeLongitude } from "../coordinates";

describe("coordinates", () => {
  it("walks a great circle along a bearing", () => {
    const north = destinationPoint({ lat: 0, lon: 0 }, 0, 111.195);
    expect(north.lat).toBeCloseTo(1, 3);
    expect(north.lon).toBeCloseTo(0, 6);

    const west = destinationPoint({ lat: 23.14, lon: 113.32 }, 262, 400);
    expect(distanceKm({ lat: 23.14, lon: 113.32 }, west)).toBeCloseTo(400, 3);
    expect(west.lon).toBeLessThan(113.32);
  });

  it("wraps longitudes across the antimeridian", () => {
    expect(normalizeLongitude(190)).toBe(-170);
    expect(destinationPoint({ lat: 0, lon: 179.9 }, 90, 50).lon).toBeLessThan(-179);
  });

  it.each([
    [0, "north"],
    [44, "northeast"],
    [100, "east"],
    [262, "west"],
    [-30, "northwest"],
  ])("names azimuth %d° %s", (azimuth, point) => {
    expect(compassPoint(azimuth)).toBe(point);
  });
});
