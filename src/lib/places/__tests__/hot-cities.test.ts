import { describe, expect, it } from "vitest";
import { HOT_CITIES } from "../hot-cities";
import { placeKey, roundPlace } from "../store";

describe("hot cities", () => {
  it("lists each city once, at a point in China", () => {
    expect(new Set(HOT_CITIES.map(city => city.name)).size).toBe(HOT_CITIES.length);
    expect(new Set(HOT_CITIES.map(placeKey)).size).toBe(HOT_CITIES.length);
    for (const city of HOT_CITIES) {
      expect(city.lat).toBeGreaterThan(18);
      expect(city.lat).toBeLessThan(54);
      expect(city.lon).toBeGreaterThan(73);
      expect(city.lon).toBeLessThan(135);
    }
  });

  it("is stored as its link and a saved place carry it", () => {
    for (const city of HOT_CITIES) {
      expect(roundPlace(city)).toEqual(city);
    }
  });
});
