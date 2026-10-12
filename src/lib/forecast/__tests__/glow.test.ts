import type { CloudLayers } from "../glow";
import { describe, expect, it } from "vitest";
import { aerosolLevel, glowLevel, scoreGlow } from "../glow";
import { PATH_DISTANCES_KM } from "../models";

/** One set of layers per sampled distance, chosen by distance in km. */
function section(layersAt: (km: number) => Partial<CloudLayers>): CloudLayers[] {
  return PATH_DISTANCES_KM.map(km => ({ low: 0, mid: 0, high: 0, ...layersAt(km) }));
}

const noAerosol = PATH_DISTANCES_KM.map(() => null);
/** Half the sky in mid cloud overhead, clear far along the path: the classic burning sky. */
const canvasOverhead = section(km => (km <= 100 ? { mid: 0.5 } : {}));

describe("scoreGlow", () => {
  it("scores a clear sky as no glow", () => {
    const result = scoreGlow({ section: section(() => ({})), aod: noAerosol, precipitation: 0 });
    expect(result.score).toBe(0);
    expect(glowLevel(result.score)).toBe("none");
  });

  it("scores a mid-cloud canvas lit through a clear path as an epic glow", () => {
    const result = scoreGlow({ section: canvasOverhead, aod: noAerosol, precipitation: 0 });
    expect(result.factors.canvasCover).toBeCloseTo(0.5);
    expect(result.factors.transmission).toBe(1);
    expect(result.score).toBeGreaterThan(0.75);
    expect(glowLevel(result.score)).toBe("epic");
  });

  it("loses the glow when low cloud along the path blocks the sun", () => {
    const blocked = section(km => (km <= 100 ? { mid: 0.5 } : {}))
      .map((layers, index) => (PATH_DISTANCES_KM[index] >= 50 ? { ...layers, low: 1 } : layers));
    const result = scoreGlow({ section: blocked, aod: noAerosol, precipitation: 0 });
    expect(result.factors.transmission).toBe(0);
    expect(result.score).toBe(0);
  });

  it("dims the glow in haze and rain", () => {
    const clean = scoreGlow({ section: canvasOverhead, aod: noAerosol, precipitation: 0 }).score;
    const hazy = scoreGlow({ section: canvasOverhead, aod: PATH_DISTANCES_KM.map(() => 0.6), precipitation: 0 });
    const rainy = scoreGlow({ section: canvasOverhead, aod: noAerosol, precipitation: 2 });
    expect(hazy.factors.aod).toBeCloseTo(0.6);
    expect(hazy.score).toBeCloseTo(clean * Math.exp(-1.1 * 0.48));
    expect(rainy.score).toBeCloseTo(clean * Math.exp(-1.6));
  });

  it("rejects input that misses a sampled distance", () => {
    expect(() => scoreGlow({ section: canvasOverhead.slice(1), aod: noAerosol, precipitation: 0 })).toThrow();
  });
});

describe("levels", () => {
  it.each([
    [0.079, "none"],
    [0.08, "faint"],
    [0.2, "small"],
    [0.35, "medium"],
    [0.55, "large"],
    [0.75, "epic"],
  ])("names glow score %d %s", (score, level) => {
    expect(glowLevel(score)).toBe(level);
  });

  it.each([
    [0.05, "pristine"],
    [0.15, "clear"],
    [0.3, "moderate"],
    [0.5, "hazy"],
    [0.9, "polluted"],
  ])("names aerosol optical depth %d %s", (aod, level) => {
    expect(aerosolLevel(aod)).toBe(level);
  });
});
