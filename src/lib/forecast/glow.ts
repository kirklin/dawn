import { PATH_DISTANCES_KM } from "./models";

export interface CloudLayers {
  /** Cloud cover fractions, 0–1: low below ~3 km, mid 3–8 km, high above 8 km. */
  low: number;
  mid: number;
  high: number;
}

export interface GlowInput {
  /** Cloud layers at each of PATH_DISTANCES_KM along the sun's azimuth. */
  section: CloudLayers[];
  /** Aerosol optical depth at the same distances; null where CAMS has no data. */
  aod: (number | null)[];
  /** Precipitation at the observer, mm per hour. */
  precipitation: number;
}

export interface GlowFactors {
  /** Mid and high cloud cover near the observer, the canvas the low sun lights from below. */
  canvasCover: number;
  canvas: number;
  /** Share of sunlight that passes under the canvas past low clouds and the far end of a mid deck. */
  transmission: number;
  /** How much of the sky the observer sees through local low cloud. */
  view: number;
  aod: number | null;
  aerosol: number;
  rain: number;
}

export interface GlowResult {
  score: number;
  factors: GlowFactors;
}

/**
 * Weights by distance (km). Shortly after sunset the light reaching clouds overhead
 * skims the lower atmosphere 100–400 km toward the sun, so low clouds there and a
 * mid deck reaching that far block it; the canvas itself is what hangs within ~100 km.
 */
const CANVAS_WEIGHTS = { 0: 0.4, 25: 0.25, 50: 0.2, 100: 0.15 };
const LOW_PATH_WEIGHTS = { 50: 0.1, 100: 0.15, 150: 0.2, 200: 0.2, 300: 0.2, 400: 0.15 };
const MID_PATH_WEIGHTS = { 150: 0.3, 200: 0.3, 300: 0.25, 400: 0.15 };
const VIEW_WEIGHTS = { 0: 0.6, 25: 0.4 };
const AOD_DISTANCES = [0, 50, 100, 150, 200, 300];

function indexOfDistance(distance: number) {
  const index = PATH_DISTANCES_KM.indexOf(distance as (typeof PATH_DISTANCES_KM)[number]);
  if (index === -1) {
    throw new Error(`${distance} km is not a sampled path distance`);
  }
  return index;
}

function weighted(section: CloudLayers[], weights: Record<number, number>, pick: (layers: CloudLayers) => number) {
  return Object.entries(weights).reduce((sum, [distance, weight]) =>
    sum + weight * pick(section[indexOfDistance(Number(distance))]), 0);
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const upperCover = (layers: CloudLayers) => 1 - (1 - layers.mid) * (1 - layers.high);

export function scoreGlow(input: GlowInput): GlowResult {
  if (input.section.length !== PATH_DISTANCES_KM.length || input.aod.length !== PATH_DISTANCES_KM.length) {
    throw new Error("Glow input must cover every sampled path distance");
  }

  const canvasCover = weighted(input.section, CANVAS_WEIGHTS, upperCover);
  // Saturating response: a quarter of the sky in mid/high cloud already makes a good canvas;
  // an unbroken sheet loses texture.
  const canvas = Math.min(1, (1 - Math.exp(-canvasCover / 0.25)) / (1 - Math.exp(-4)))
    * (1 - 0.25 * smoothstep(0.85, 1, canvasCover));

  const lowBlock = weighted(input.section, LOW_PATH_WEIGHTS, layers => layers.low);
  const midBlock = weighted(input.section, MID_PATH_WEIGHTS, layers => layers.mid);
  const transmission = (1 - lowBlock) ** 1.5 * (1 - midBlock) ** 1.2;

  const localLow = weighted(input.section, VIEW_WEIGHTS, layers => layers.low);
  const view = 1 - 0.95 * localLow ** 1.3;

  const aods = AOD_DISTANCES.map(distance => input.aod[indexOfDistance(distance)]).filter(value => value !== null);
  const aod = aods.length > 0 ? aods.reduce((sum, value) => sum + value, 0) / aods.length : null;
  const aerosol = aod === null ? 1 : Math.exp(-1.1 * Math.max(0, aod - 0.12));

  const rain = Math.exp(-0.8 * input.precipitation);

  return {
    score: canvas * transmission * view * aerosol * rain,
    factors: { canvasCover, canvas, transmission, view, aod, aerosol, rain },
  };
}

export const GLOW_LEVELS = [
  { level: "none", min: 0 },
  { level: "faint", min: 0.08 },
  { level: "small", min: 0.2 },
  { level: "medium", min: 0.35 },
  { level: "large", min: 0.55 },
  { level: "epic", min: 0.75 },
] as const;

export type GlowLevel = (typeof GLOW_LEVELS)[number]["level"];

export function glowLevel(score: number): GlowLevel {
  let level: GlowLevel = "none";
  for (const entry of GLOW_LEVELS) {
    if (score >= entry.min) {
      level = entry.level;
    }
  }
  return level;
}

/** Score spread between the cloud models from which they count as disagreeing, about one glow level apart. */
export const MODEL_DISAGREEMENT = 0.15;

export const AEROSOL_LEVELS = [
  { level: "pristine", max: 0.1 },
  { level: "clear", max: 0.2 },
  { level: "moderate", max: 0.4 },
  { level: "hazy", max: 0.7 },
  { level: "polluted", max: Infinity },
] as const;

export type AerosolLevel = (typeof AEROSOL_LEVELS)[number]["level"];

export function aerosolLevel(aod: number): AerosolLevel {
  return AEROSOL_LEVELS.find(entry => aod < entry.max)!.level;
}
