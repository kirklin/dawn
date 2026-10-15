import type { CloudLayers } from "./glow";
import type { ModelId } from "./models";
import type { AerosolForecast, CloudForecast, ModelRuns, Wind, WindForecast, WindLayer } from "./open-meteo";
import type { GlowEvent, GlowEventKind, GlowModelResult, ObserverHour, PlaceForecast, SkyTrack } from "./types";
import type { LatLon } from "~/lib/geo/coordinates";
import { moonState, nextMoonEvent, upcomingQuarters } from "~/lib/astro/moon";
import { createObserver, nextSunEvent, sunDay } from "~/lib/astro/sun";
import { destinationPoint, roundCoordinate } from "~/lib/geo/coordinates";
import { addDays, MINUTE_MS, zonedDateKey } from "~/lib/time/zoned";
import { glowLevel, scoreGlow } from "./glow";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "./models";
import { fetchAerosolForecast, fetchCloudForecast, fetchModelRuns, fetchWindForecast, WIND_LEVELS } from "./open-meteo";
import { valueAt } from "./series";

/** Clouds catch the most color shortly after sunset and before sunrise. */
const GLOW_PEAK_OFFSET_MINUTES = 10;

const WIND_LAYERS = Object.keys(WIND_LEVELS) as WindLayer[];

function roundLatLon(point: LatLon): LatLon {
  return { lat: roundCoordinate(point.lat), lon: roundCoordinate(point.lon) };
}

function pathPoints(origin: LatLon, azimuth: number) {
  return PATH_DISTANCES_KM.slice(1).map(distance => roundLatLon(destinationPoint(origin, azimuth, distance)));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The values, or null when any of them is missing. */
function complete<T>(values: (T | null)[]): T[] | null {
  return values.every((value): value is T => value !== null) ? values : null;
}

/** Where a place's forecast is read: the place itself, then points toward its sunset and its sunrise. */
export interface ForecastSampling {
  origin: LatLon;
  /** Of the next sunset and sunrise; null where the sun does not cross the horizon in the forecast days. */
  azimuths: Record<GlowEventKind, number | null>;
  points: LatLon[];
  /** Position in `points` of the first point along each path. */
  pathStart: Partial<Record<GlowEventKind, number>>;
}

export function forecastSampling(location: LatLon, now: number): ForecastSampling {
  const origin = roundLatLon(location);

  // Every glow is sampled along the azimuth of the next one. It drifts a few degrees over the forecast
  // days, a few tens of kilometres at the far end of the path by the last day, finer than the models
  // place clouds that far ahead.
  const groundObserver = createObserver(origin.lat, origin.lon, 0);
  const azimuths = {
    sunset: nextSunEvent(groundObserver, -1, now, FORECAST_DAYS)?.azimuth ?? null,
    sunrise: nextSunEvent(groundObserver, 1, now, FORECAST_DAYS)?.azimuth ?? null,
  } satisfies Record<GlowEventKind, number | null>;

  const points: LatLon[] = [origin];
  const pathStart: Partial<Record<GlowEventKind, number>> = {};
  for (const kind of ["sunset", "sunrise"] as const) {
    const azimuth = azimuths[kind];
    if (azimuth !== null) {
      pathStart[kind] = points.length;
      points.push(...pathPoints(origin, Math.round(azimuth)));
    }
  }
  return { origin, azimuths, points, pathStart };
}

/** Model output at a sampling's points, in their order. */
export interface ForecastData {
  clouds: CloudForecast;
  aerosols: AerosolForecast;
  winds: WindForecast;
  runs: ModelRuns;
}

export async function getPlaceForecast(location: LatLon, now = Date.now()): Promise<PlaceForecast> {
  const sampling = forecastSampling(location, now);
  const [clouds, aerosols, winds, runs] = await Promise.all([
    fetchCloudForecast(sampling.points),
    fetchAerosolForecast(sampling.points),
    fetchWindForecast(sampling.origin),
    fetchModelRuns(),
  ]);
  return buildPlaceForecast(sampling, { clouds, aerosols, winds, runs }, now);
}

/**
 * A glow is rated only where every cloud model reaches it, so that the models can be compared; the
 * sky and the hourly cloud go on with the models that run further.
 */
export function buildPlaceForecast(sampling: ForecastSampling, { clouds, aerosols, winds, runs }: ForecastData, now: number): PlaceForecast {
  const { origin, azimuths, pathStart } = sampling;
  const { timezone, elevation } = clouds;
  const observer = createObserver(origin.lat, origin.lon, elevation);
  const today = zonedDateKey(now, timezone);
  const dates = Array.from({ length: FORECAST_DAYS }, (_, index) => addDays(today, index));
  const days = dates.map(date => sunDay(observer, date, timezone));

  const pointIndex = (kind: GlowEventKind, distanceIndex: number) => {
    if (distanceIndex === 0) {
      return 0;
    }
    const start = pathStart[kind];
    if (start === undefined) {
      throw new Error(`No ${kind} path was sampled`);
    }
    return start + distanceIndex - 1;
  };

  /** A model's cloud layers over a point; null past the end of its run. */
  const layersAt = (index: number, model: ModelId, at: number): CloudLayers | null => {
    const hours = clouds.points[index][model];
    const low = valueAt(clouds.time, hours.low, at);
    const mid = valueAt(clouds.time, hours.mid, at);
    const high = valueAt(clouds.time, hours.high, at);
    return low === null || mid === null || high === null ? null : { low, mid, high };
  };

  /** A model's wind at every cloud layer over the place; null past the end of its run. */
  const modelWindAt = (model: ModelId, at: number): Record<WindLayer, Wind> | null => {
    const layers = complete(WIND_LAYERS.map((layer) => {
      const east = valueAt(winds.time, winds.models[model][layer].east, at);
      const north = valueAt(winds.time, winds.models[model][layer].north, at);
      return east === null || north === null ? null : { east, north };
    }));
    return layers && Object.fromEntries(WIND_LAYERS.map((layer, index) => [layer, layers[index]])) as Record<WindLayer, Wind>;
  };

  const meanWind = (modelWinds: Record<WindLayer, Wind>[]) => Object.fromEntries(WIND_LAYERS.map(layer => [layer, {
    east: mean(modelWinds.map(wind => wind[layer].east)),
    north: mean(modelWinds.map(wind => wind[layer].north)),
  }])) as Record<WindLayer, Wind>;

  /** The glow at a sunrise or sunset; null when a model's run ends before it. */
  const glowEvent = (kind: GlowEventKind, date: string, time: number, azimuth: number): GlowEvent | null => {
    const scoredAt = time + (kind === "sunset" ? 1 : -1) * GLOW_PEAK_OFFSET_MINUTES * MINUTE_MS;
    const indexes = PATH_DISTANCES_KM.map((_, distanceIndex) => pointIndex(kind, distanceIndex));
    const aod = indexes.map(index => valueAt(aerosols.time, aerosols.points[index], scoredAt));
    const modelWinds = complete(MODEL_IDS.map(model => modelWindAt(model, scoredAt)));
    const results = complete(MODEL_IDS.map((model) => {
      const section = complete(indexes.map(index => layersAt(index, model, scoredAt)));
      const precipitation = valueAt(clouds.time, clouds.points[0][model].precipitation, scoredAt);
      return section && precipitation !== null ? { ...scoreGlow({ section, aod, precipitation }), section } : null;
    }));
    if (!modelWinds || !results) {
      return null;
    }

    const models = Object.fromEntries(MODEL_IDS.map((model, index) => [model, results[index]])) as Record<ModelId, GlowModelResult>;
    const score = mean(results.map(result => result.score));
    return {
      kind,
      date,
      time,
      scoredAt,
      azimuth,
      score,
      level: glowLevel(score),
      aod: results[0].factors.aod,
      wind: meanWind(modelWinds),
      models,
    };
  };

  const events = days.flatMap(day => [
    day.sunrise !== null && day.sunriseAzimuth !== null ? glowEvent("sunrise", day.date, day.sunrise, day.sunriseAzimuth) : null,
    day.sunset !== null && day.sunsetAzimuth !== null ? glowEvent("sunset", day.date, day.sunset, day.sunsetAzimuth) : null,
  ]).filter(event => event !== null);

  const firstHour = days[0].start;
  const endHour = days[days.length - 1].end;
  const hours: ObserverHour[] = clouds.time.flatMap((time, index) => {
    const covers = MODEL_IDS.flatMap((model) => {
      const cover = clouds.points[0][model].total[index];
      return cover === null ? [] : [cover];
    });
    return time >= firstHour && time < endHour && covers.length > 0 ? [{ time, cloud: mean(covers) }] : [];
  });

  // The sky can be shown at any moment of the forecast days, so the track runs to the hour that ends them,
  // or to the last hour a model reaches.
  const trackHours = clouds.time.flatMap((time, index) => time >= firstHour && time <= endHour ? [index] : []);
  const skyTrack = (kind: GlowEventKind, azimuth: number): SkyTrack => {
    const indexes = PATH_DISTANCES_KM.map((_, distanceIndex) => pointIndex(kind, distanceIndex));
    return {
      azimuth,
      hours: trackHours.flatMap((hour) => {
        const time = clouds.time[hour];
        const aod = indexes.map(index => valueAt(aerosols.time, aerosols.points[index], time));
        const results = MODEL_IDS.flatMap((model) => {
          const section = complete(indexes.map(index => layersAt(index, model, time)));
          const precipitation = clouds.points[0][model].precipitation[hour];
          return section && precipitation !== null ? [{ section, ...scoreGlow({ section, aod, precipitation }) }] : [];
        });
        const modelWinds = MODEL_IDS.flatMap((model) => {
          const wind = modelWindAt(model, time);
          return wind ? [wind] : [];
        });
        if (results.length === 0 || modelWinds.length === 0) {
          return [];
        }
        const layer = (distance: number, pick: (layers: CloudLayers) => number) => round(mean(results.map(result => pick(result.section[distance]))));
        return [{
          time,
          cover: PATH_DISTANCES_KM.map((_, distance) => [
            layer(distance, layers => layers.low),
            layer(distance, layers => layers.mid),
            layer(distance, layers => layers.high),
          ]),
          transmission: round(mean(results.map(result => result.factors.transmission))),
          aod: results[0].factors.aod,
          wet: round(1 - mean(results.map(result => result.factors.rain))),
          wind: meanWind(modelWinds),
        }];
      }),
    };
  };
  const tracks: PlaceForecast["tracks"] = {};
  for (const kind of ["sunrise", "sunset"] as const) {
    const azimuth = azimuths[kind];
    if (azimuth !== null) {
      tracks[kind] = skyTrack(kind, Math.round(azimuth));
    }
  }

  return {
    lat: origin.lat,
    lon: origin.lon,
    elevation,
    timezone,
    generatedAt: now,
    runs,
    days,
    hours,
    events,
    tracks,
    moon: {
      state: moonState(now),
      quarters: upcomingQuarters(now, 4),
      nextRise: nextMoonEvent(observer, 1, now, 2),
      nextSet: nextMoonEvent(observer, -1, now, 2),
    },
  };
}

/** Three decimals are finer than any forecast and keep the page payload small. */
function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
