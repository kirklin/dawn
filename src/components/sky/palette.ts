import { roundForMarkup } from "./markup";

export type Rgb = readonly [number, number, number];

interface SkyStop {
  altitude: number;
  top: Rgb;
  bottom: Rgb;
}

/** Clear-sky gradient keyed by sun altitude, from full night to full day. */
const CLEAR_SKY: SkyStop[] = [
  { altitude: -18, top: [6, 10, 26], bottom: [17, 25, 52] },
  { altitude: -12, top: [13, 21, 50], bottom: [36, 45, 90] },
  { altitude: -6, top: [27, 36, 80], bottom: [88, 84, 148] },
  { altitude: -3, top: [41, 56, 112], bottom: [206, 116, 112] },
  { altitude: 0, top: [50, 78, 140], bottom: [240, 160, 92] },
  { altitude: 6, top: [40, 98, 182], bottom: [136, 182, 228] },
  { altitude: 20, top: [30, 98, 194], bottom: [98, 162, 230] },
];

const OVERCAST_NIGHT = { top: [26, 30, 37] as Rgb, bottom: [41, 46, 55] as Rgb };
const OVERCAST_DAY = { top: [94, 106, 121] as Rgb, bottom: [138, 149, 162] as Rgb };

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [0, 1, 2].map(index => Math.round(a[index] + (b[index] - a[index]) * amount)) as unknown as Rgb;
}

function clearSky(altitude: number) {
  if (altitude <= CLEAR_SKY[0].altitude) {
    return CLEAR_SKY[0];
  }
  for (let index = 1; index < CLEAR_SKY.length; index++) {
    const upper = CLEAR_SKY[index];
    if (altitude <= upper.altitude) {
      const lower = CLEAR_SKY[index - 1];
      const amount = (altitude - lower.altitude) / (upper.altitude - lower.altitude);
      return { altitude, top: mix(lower.top, upper.top, amount), bottom: mix(lower.bottom, upper.bottom, amount) };
    }
  }
  return CLEAR_SKY[CLEAR_SKY.length - 1];
}

export interface SkyColors {
  top: Rgb;
  bottom: Rgb;
}

export function skyColors(altitude: number, cloud: number): SkyColors {
  const clear = clearSky(altitude);
  const daylight = clamp01((altitude + 8) / 14);
  const overcastTop = mix(OVERCAST_NIGHT.top, OVERCAST_DAY.top, daylight);
  const overcastBottom = mix(OVERCAST_NIGHT.bottom, OVERCAST_DAY.bottom, daylight);
  const veil = roundForMarkup(0.85 * clamp01(cloud) ** 1.3);
  return { top: mix(clear.top, overcastTop, veil), bottom: mix(clear.bottom, overcastBottom, veil) };
}

export function rgb(color: Rgb) {
  return `rgb(${color[0]} ${color[1]} ${color[2]})`;
}
