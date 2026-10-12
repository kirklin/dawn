/** Side of the square, seamlessly tiling noise texture the cloud shader samples. */
export const NOISE_SIZE = 256;

/**
 * Spread of the gradient noise channels, and mean and spread of the cellular one: the cloud shader
 * cuts the noise by them to leave exactly the forecast cover.
 */
export const NOISE_STATS = { gradientSpread: 0.15, cellularMean: 0.571, cellularSpread: 0.186 } as const;

function seededRandom(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Tiling gradient noise with `cells` lattice cells across the texture, scaled to 0–1. */
function gradientNoise(random: () => number, cells: number) {
  const angles = Array.from({ length: cells * cells }, () => random() * Math.PI * 2);
  const gradients = angles.map(angle => [Math.cos(angle), Math.sin(angle)] as const);
  const gradient = (x: number, y: number) => gradients[((y % cells) + cells) % cells * cells + ((x % cells) + cells) % cells];
  const values = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  for (let py = 0; py < NOISE_SIZE; py++) {
    for (let px = 0; px < NOISE_SIZE; px++) {
      const x = (px / NOISE_SIZE) * cells;
      const y = (py / NOISE_SIZE) * cells;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const dot = (cx: number, cy: number) => {
        const [gx, gy] = gradient(cx, cy);
        return gx * (x - cx) + gy * (y - cy);
      };
      const u = fade(fx);
      const v = fade(fy);
      const top = dot(x0, y0) + (dot(x0 + 1, y0) - dot(x0, y0)) * u;
      const bottom = dot(x0, y0 + 1) + (dot(x0 + 1, y0 + 1) - dot(x0, y0 + 1)) * u;
      values[py * NOISE_SIZE + px] = 0.5 + 0.7 * (top + (bottom - top) * v);
    }
  }
  return values;
}

/** Tiling cellular noise: 1 at the feature points, falling to 0 at the cell borders, for puffy clouds. */
function cellularNoise(random: () => number, cells: number) {
  const points = Array.from({ length: cells * cells }, () => [random(), random()] as const);
  const values = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  for (let py = 0; py < NOISE_SIZE; py++) {
    for (let px = 0; px < NOISE_SIZE; px++) {
      const x = (px / NOISE_SIZE) * cells;
      const y = (py / NOISE_SIZE) * cells;
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      let nearest = Infinity;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox;
          const gy = cy + oy;
          const [jx, jy] = points[((gy % cells) + cells) % cells * cells + ((gx % cells) + cells) % cells];
          const dx = gx + jx - x;
          const dy = gy + jy - y;
          nearest = Math.min(nearest, dx * dx + dy * dy);
        }
      }
      values[py * NOISE_SIZE + px] = 1 - Math.min(1, Math.sqrt(nearest));
    }
  }
  return values;
}

let texture: Uint8Array | null = null;

/**
 * RGBA noise texture, built once: R and B gradient noise for cloud masses and cirrus fibres,
 * G cellular noise for cloudlets, A fine gradient noise for detail.
 */
export function cloudNoiseTexture() {
  if (texture) {
    return texture;
  }
  const random = seededRandom(20261012);
  const channels = [
    gradientNoise(random, 8),
    cellularNoise(random, 12),
    gradientNoise(random, 16),
    gradientNoise(random, 32),
  ];
  texture = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  for (let index = 0; index < NOISE_SIZE * NOISE_SIZE; index++) {
    for (let channel = 0; channel < 4; channel++) {
      texture[index * 4 + channel] = Math.round(Math.min(1, Math.max(0, channels[channel][index])) * 255);
    }
  }
  return texture;
}
