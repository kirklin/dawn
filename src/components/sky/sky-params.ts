import type { SunDay } from "~/lib/astro/sun";
import type { Wind, WindLayer } from "~/lib/forecast/open-meteo";
import type { GlowEvent, PlaceForecast, SkyHour, SkyTrack } from "~/lib/forecast/types";
import { GOLDEN_HOUR_TOP } from "~/lib/astro/constants";
import { PATH_DISTANCES_KM } from "~/lib/forecast/models";
import { dayAt, solarNoon, sunAltitudeAt, sunAzimuthAt } from "~/lib/forecast/selectors";
import { MINUTE_MS } from "~/lib/time/zoned";

/** What the sky shader needs to draw the sky at one moment. */
export interface SkyParams {
  /** Sun altitude in radians. */
  sun: number;
  /** Sun azimuth in radians from the direction of view, positive to the right. */
  sunAzimuth: number;
  /** Low, mid and high cloud cover at each of PATH_DISTANCES_KM along the view. */
  cover: (readonly [number, number, number])[];
  transmission: number;
  aod: number;
  /** 0 when dry, toward 1 in heavy rain. */
  wet: number;
  /** Wind at the low, mid and high cloud layers in m/s: to the right of the view, and away from the viewer. */
  wind: (readonly [number, number])[];
  /** Offset into the cloud noise, fixed per place so the cloud shapes stay put while time moves. */
  seed: readonly [number, number];
}

/** Clean continental air when CAMS has no aerosol forecast that far ahead. */
const TYPICAL_AOD = 0.12;
/**
 * A glow is shown about three minutes after sunset (before sunrise), with the sun just under the
 * horizon: clouds overhead glow orange while those toward the sun still catch gold.
 */
const GLOW_OFFSET_MS = 3 * MINUTE_MS;
/** Sun altitude, in degrees, by which the view has turned its back on the climbing sun. */
const TURNED_ALTITUDE = 20;
const WIND_LAYERS: WindLayer[] = ["low", "mid", "high"];
const DEGREES = Math.PI / 180;

export function placeSeed(lat: number, lon: number): readonly [number, number] {
  return [(lat * 37.3) % 97, (lon * 11.7) % 89];
}

/** The moment that shows a glow at its best. */
export function glowMoment(event: Pick<GlowEvent, "kind" | "time">) {
  return event.time + (event.kind === "sunset" ? 1 : -1) * GLOW_OFFSET_MS;
}

/** Turns a wind into the frame of a viewer facing `azimuth` degrees. */
export function viewWind(wind: Wind, azimuth: number): readonly [number, number] {
  const facing = azimuth * DEGREES;
  return [
    wind.east * Math.cos(facing) - wind.north * Math.sin(facing),
    wind.east * Math.sin(facing) + wind.north * Math.cos(facing),
  ];
}

/** Signed difference `to - from` between two azimuths in degrees, the short way round. */
function turnBetween(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * How far the view has turned from the sunrise toward the sunset: not at all while the sun is low in the
 * morning, half once it has climbed to TURNED_ALTITUDE or its noon height, and all the way back down as it
 * sinks to the golden hour in the evening. The view so faces the low sun and turns away once it would glare.
 */
function eveningShare(day: SunDay, time: number, altitude: number) {
  const highest = Math.max(...day.altitudes);
  const climbed = highest > 0
    ? smoothstep(Math.min(GOLDEN_HOUR_TOP, highest / 2), Math.min(TURNED_ALTITUDE, highest), altitude)
    : 1;
  return time < solarNoon(day) ? climbed / 2 : 1 - climbed / 2;
}

/**
 * Azimuth the view faces: toward the sunrise in the morning and the sunset in the evening, turning
 * between them by the side away from the sun, so the sun is never stared into once it is up.
 */
function viewAzimuth(sunrise: number, sunset: number, noonSun: number, evening: number) {
  const clockwise = ((sunset - sunrise) % 360 + 360) % 360;
  const counter = clockwise - 360;
  const fromSun = (turn: number) => Math.abs(turnBetween(noonSun, sunrise + turn / 2));
  const turn = fromSun(clockwise) >= fromSun(counter) ? clockwise : counter;
  return (sunrise + turn * evening + 360) % 360;
}

/** A track's hour at `time`, interpolated between forecast hours and held at either end. */
function hourAt(track: SkyTrack, time: number): SkyHour {
  const { hours } = track;
  if (time <= hours[0].time) {
    return hours[0];
  }
  const next = hours.findIndex(hour => hour.time > time);
  if (next === -1) {
    return hours[hours.length - 1];
  }
  const before = hours[next - 1];
  return mixHours(before, hours[next], (time - before.time) / (hours[next].time - before.time));
}

function mixHours(from: SkyHour, to: SkyHour, amount: number): SkyHour {
  const lerp = (a: number, b: number) => a + (b - a) * amount;
  const wind = (layer: WindLayer) => ({
    east: lerp(from.wind[layer].east, to.wind[layer].east),
    north: lerp(from.wind[layer].north, to.wind[layer].north),
  });
  return {
    time: lerp(from.time, to.time),
    cover: from.cover.map((layers, index) => [
      lerp(layers[0], to.cover[index][0]),
      lerp(layers[1], to.cover[index][1]),
      lerp(layers[2], to.cover[index][2]),
    ]),
    transmission: lerp(from.transmission, to.transmission),
    aod: from.aod === null || to.aod === null ? from.aod ?? to.aod : lerp(from.aod, to.aod),
    wet: lerp(from.wet, to.wet),
    wind: { low: wind("low"), mid: wind("mid"), high: wind("high") },
  };
}

/** The forecast along the view and the view's azimuth at `time`, when the sun stands at `altitude` degrees. */
function viewAt(forecast: Pick<PlaceForecast, "days" | "tracks">, day: SunDay, time: number, altitude: number) {
  const { sunrise, sunset } = forecast.tracks;
  if (sunrise && sunset) {
    const evening = eveningShare(day, time, altitude);
    const noonSun = sunAzimuthAt([day], solarNoon(day)) ?? 180;
    return {
      hour: mixHours(hourAt(sunrise, time), hourAt(sunset, time), evening),
      azimuth: viewAzimuth(sunrise.azimuth, sunset.azimuth, noonSun, evening),
    };
  }
  const track = sunrise ?? sunset;
  return track ? { hour: hourAt(track, time), azimuth: track.azimuth } : null;
}

/** The forecast sky at `time`. */
export function skyParamsAt(forecast: Pick<PlaceForecast, "days" | "tracks" | "lat" | "lon">, time: number): SkyParams {
  const day = dayAt(forecast.days, time);
  const altitude = sunAltitudeAt(forecast.days, time);
  const azimuth = sunAzimuthAt(forecast.days, time);
  if (!day || altitude === null || azimuth === null) {
    throw new Error(`No sun position at ${new Date(time).toISOString()}`);
  }
  const seed = placeSeed(forecast.lat, forecast.lon);
  const view = viewAt(forecast, day, time, altitude);
  if (!view) {
    // No sunrise or sunset ahead: look away from the noon sun at a clear sky.
    const facing = ((sunAzimuthAt([day], solarNoon(day)) ?? 180) + 180) % 360;
    return {
      sun: altitude * DEGREES,
      sunAzimuth: turnBetween(facing, azimuth) * DEGREES,
      cover: PATH_DISTANCES_KM.map(() => [0, 0, 0] as const),
      transmission: 1,
      aod: TYPICAL_AOD,
      wet: 0,
      wind: WIND_LAYERS.map(() => [0, 0] as const),
      seed,
    };
  }
  const { hour } = view;
  return {
    sun: altitude * DEGREES,
    sunAzimuth: turnBetween(view.azimuth, azimuth) * DEGREES,
    cover: hour.cover.map(layers => [layers[0], layers[1], layers[2]] as const),
    transmission: hour.transmission,
    aod: hour.aod ?? TYPICAL_AOD,
    wet: hour.wet,
    wind: WIND_LAYERS.map(layer => viewWind(hour.wind[layer], view.azimuth)),
    seed,
  };
}

/** Linear blend of two parameter sets, for morphing the sky when the moment jumps. */
export function blendSkyParams(from: SkyParams, to: SkyParams, amount: number): SkyParams {
  const lerp = (a: number, b: number) => a + (b - a) * amount;
  const turn = Math.atan2(Math.sin(to.sunAzimuth - from.sunAzimuth), Math.cos(to.sunAzimuth - from.sunAzimuth));
  return {
    sun: lerp(from.sun, to.sun),
    sunAzimuth: from.sunAzimuth + turn * amount,
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
