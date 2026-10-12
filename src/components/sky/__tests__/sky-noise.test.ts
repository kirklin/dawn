import { describe, expect, it } from "vitest";
import { cloudNoiseTexture, NOISE_SIZE, NOISE_STATS } from "../sky-noise";

const data = cloudNoiseTexture();
const at = (channel: number, row: number, column: number) => data[(row * NOISE_SIZE + column) * 4 + channel] / 255;

function stats(channel: number) {
  const values = Array.from({ length: NOISE_SIZE * NOISE_SIZE }, (_, index) => data[index * 4 + channel] / 255);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return { mean, spread };
}

describe("cloudNoiseTexture", () => {
  it("has the statistics the cloud shader cuts it by", () => {
    for (const channel of [0, 2, 3]) {
      const { mean, spread } = stats(channel);
      expect(mean).toBeCloseTo(0.5, 2);
      expect(Math.abs(spread - NOISE_STATS.gradientSpread)).toBeLessThan(0.005);
    }
    const cellular = stats(1);
    expect(Math.abs(cellular.mean - NOISE_STATS.cellularMean)).toBeLessThan(0.005);
    expect(Math.abs(cellular.spread - NOISE_STATS.cellularSpread)).toBeLessThan(0.005);
  });

  it("tiles without a seam", () => {
    for (let channel = 0; channel < 4; channel++) {
      let inner = 0;
      let wrap = 0;
      for (let row = 0; row < NOISE_SIZE; row++) {
        for (let column = 0; column < NOISE_SIZE - 1; column++) {
          inner = Math.max(inner, Math.abs(at(channel, row, column + 1) - at(channel, row, column)), Math.abs(at(channel, column + 1, row) - at(channel, column, row)));
        }
        wrap = Math.max(wrap, Math.abs(at(channel, row, 0) - at(channel, row, NOISE_SIZE - 1)), Math.abs(at(channel, 0, row) - at(channel, NOISE_SIZE - 1, row)));
      }
      expect(wrap).toBeLessThanOrEqual(inner);
    }
  });

  it("is built once", () => {
    expect(cloudNoiseTexture()).toBe(data);
  });
});
