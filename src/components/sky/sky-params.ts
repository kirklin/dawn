import type { Wind } from "~/lib/forecast/open-meteo";
import type { GlowEvent, PlaceForecast } from "~/lib/forecast/types";
import { MODEL_IDS, PATH_DISTANCES_KM } from "~/lib/forecast/models";
import { sunAltitudeAt } from "~/lib/forecast/selectors";
import { MINUTE_MS } from "~/lib/time/zoned";

/** What the sky shader needs to draw the forecast sky of one glow event. */
export interface SkyParams {
  /** Sun altitude in radians at the moment painted. */
  sun: number;
  /** Low, mid and high cloud cover at each of PATH_DISTANCES_KM toward the sun. */
  cover: (readonly [number, number, number])[];
  transmission: number;
  aod: number;
  /** 0 when dry, toward 1 in heavy rain. */
  wet: number;
  /** Wind at the low, mid and high cloud layers in m/s: to the right of the sun's azimuth, and toward the sun. */
  wind: (readonly [number, number])[];
  /** Offset into the cloud noise, fixed per place so switching events keeps the cloud shapes. */
  seed: readonly [number, number];
}

/** Clean continental air when CAMS has no aerosol forecast that far ahead. */
const TYPICAL_AOD = 0.12;
/**
 * The sky is painted about three minutes after sunset (before sunrise), with the sun just under the
 * horizon: clouds overhead glow orange while those toward the sun still catch gold.
 */
const PAINTED_OFFSET_MS = 3 * MINUTE_MS;
const QUIET_SUN = -0.6 * (Math.PI / 180);
const WIND_LAYERS = ["low", "mid", "high"] as const;

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function placeSeed(lat: number, lon: number): readonly [number, number] {
  return [(lat * 37.3) % 97, (lon * 11.7) % 89];
}

/** Turns a wind into the frame of a viewer facing `azimuth` degrees. */
export function viewWind(wind: Wind, azimuth: number): readonly [number, number] {
  const facing = azimuth * (Math.PI / 180);
  return [
    wind.east * Math.cos(facing) - wind.north * Math.sin(facing),
    wind.east * Math.sin(facing) + wind.north * Math.cos(facing),
  ];
}

export function skyParams(event: GlowEvent, forecast: Pick<PlaceForecast, "days" | "lat" | "lon">): SkyParams {
  const painted = event.time + (event.kind === "sunset" ? 1 : -1) * PAINTED_OFFSET_MS;
  const altitude = sunAltitudeAt(forecast.days, painted);
  if (altitude === null) {
    throw new Error(`No sun altitude for the glow event at ${new Date(painted).toISOString()}`);
  }
  return {
    sun: altitude * (Math.PI / 180),
    cover: PATH_DISTANCES_KM.map((_, index) => [
      mean(MODEL_IDS.map(model => event.models[model].section[index].low)),
      mean(MODEL_IDS.map(model => event.models[model].section[index].mid)),
      mean(MODEL_IDS.map(model => event.models[model].section[index].high)),
    ] as const),
    transmission: mean(MODEL_IDS.map(model => event.models[model].factors.transmission)),
    aod: event.aod ?? TYPICAL_AOD,
    wet: 1 - mean(MODEL_IDS.map(model => event.models[model].factors.rain)),
    wind: WIND_LAYERS.map(layer => viewWind(event.wind[layer], event.azimuth)),
    seed: placeSeed(forecast.lat, forecast.lon),
  };
}

/** A clear dusk for places where the sun neither rises nor sets in the coming days. */
export function quietSkyParams(lat: number, lon: number): SkyParams {
  return {
    sun: QUIET_SUN,
    cover: PATH_DISTANCES_KM.map(() => [0, 0, 0] as const),
    transmission: 1,
    aod: TYPICAL_AOD,
    wet: 0,
    wind: WIND_LAYERS.map(() => [0, 0] as const),
    seed: placeSeed(lat, lon),
  };
}

/** Linear blend of two parameter sets, for morphing the sky when another event is selected. */
export function blendSkyParams(from: SkyParams, to: SkyParams, amount: number): SkyParams {
  const lerp = (a: number, b: number) => a + (b - a) * amount;
  return {
    sun: lerp(from.sun, to.sun),
    cover: to.cover.map((layers, index) => [
      lerp(from.cover[index][0], layers[0]),
      lerp(from.cover[index][1], layers[1]),
      lerp(from.cover[index][2], layers[2]),
    ] as const),
    transmission: lerp(from.transmission, to.transmission),
    aod: lerp(from.aod, to.aod),
    wet: lerp(from.wet, to.wet),
    wind: to.wind.map((wind, index) => [lerp(from.wind[index][0], wind[0]), lerp(from.wind[index][1], wind[1])] as const),
    seed: to.seed,
  };
}
