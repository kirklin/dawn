import type { CloudLayers } from "./glow";
import type { ModelId } from "./models";
import type { CloudForecast, Wind, WindLayer } from "./open-meteo";
import type { GlowEvent, GlowEventKind, GlowModelResult, ObserverHour, PlaceForecast, SkyTrack } from "./types";
import type { LatLon } from "~/lib/geo/coordinates";
import { moonState, nextMoonEvent, upcomingQuarters } from "~/lib/astro/moon";
import { createObserver, nextSunEvent, sunDay } from "~/lib/astro/sun";
import { destinationPoint, roundCoordinate } from "~/lib/geo/coordinates";
import { addDays, MINUTE_MS, zonedDateKey } from "~/lib/time/zoned";
import { glowLevel, scoreGlow } from "./glow";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "./models";
import { fetchAerosolForecast, fetchCloudForecast, fetchModelRuns, fetchWindForecast, WIND_LEVELS } from "./open-meteo";
import { requireValueAt, valueAt } from "./series";

/** Clouds catch the most color shortly after sunset and before sunrise. */
const GLOW_PEAK_OFFSET_MINUTES = 10;

function roundLatLon(point: LatLon): LatLon {
  return { lat: roundCoordinate(point.lat), lon: roundCoordinate(point.lon) };
}

function pathPoints(origin: LatLon, azimuth: number) {
  return PATH_DISTANCES_KM.slice(1).map(distance => roundLatLon(destinationPoint(origin, azimuth, distance)));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function getPlaceForecast(location: LatLon, now = Date.now()): Promise<PlaceForecast> {
  const origin = roundLatLon(location);

  // Sample every glow event along the azimuth of the next one; it drifts by well under a
  // degree over the forecast range, far below the model grid spacing at 400 km.
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

  const [clouds, aerosols, winds, runs] = await Promise.all([
    fetchCloudForecast(points),
    fetchAerosolForecast(points),
    fetchWindForecast(origin),
    fetchModelRuns(),
  ]);

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

  const layersAt = (forecast: CloudForecast, index: number, model: ModelId, at: number): CloudLayers => {
    const hours = forecast.points[index][model];
    const label = `${model} point ${index}`;
    return {
      low: requireValueAt(forecast.time, hours.low, at, `${label} low cloud`),
      mid: requireValueAt(forecast.time, hours.mid, at, `${label} mid cloud`),
      high: requireValueAt(forecast.time, hours.high, at, `${label} high cloud`),
    };
  };

  const windAt = (layer: WindLayer, at: number): Wind => {
    const component = (pick: (wind: Wind) => number) => mean(MODEL_IDS.map(model =>
      requireValueAt(winds.time, winds.models[model][layer].map(pick), at, `${model} ${layer} cloud wind`)));
    return { east: component(wind => wind.east), north: component(wind => wind.north) };
  };

  const glowEvent = (kind: GlowEventKind, date: string, time: number, azimuth: number): GlowEvent => {
    const scoredAt = time + (kind === "sunset" ? 1 : -1) * GLOW_PEAK_OFFSET_MINUTES * MINUTE_MS;
    const indexes = PATH_DISTANCES_KM.map((_, distanceIndex) => pointIndex(kind, distanceIndex));
    const aod = indexes.map(index => valueAt(aerosols.time, aerosols.points[index], scoredAt));
    const wind = Object.fromEntries(Object.keys(WIND_LEVELS).map(layer => [layer, windAt(layer as WindLayer, scoredAt)])) as Record<WindLayer, Wind>;

    const models = Object.fromEntries(MODEL_IDS.map((model) => {
      const section = indexes.map(index => layersAt(clouds, index, model, scoredAt));
      const precipitation = requireValueAt(clouds.time, clouds.points[0][model].precipitation, scoredAt, `${model} precipitation`);
      const result: GlowModelResult = { ...scoreGlow({ section, aod, precipitation }), section };
      return [model, result];
    })) as Record<ModelId, GlowModelResult>;

    const score = mean(MODEL_IDS.map(model => models[model].score));
    return {
      kind,
      date,
      time,
      scoredAt,
      azimuth,
      score,
      level: glowLevel(score),
      aod: models[MODEL_IDS[0]].factors.aod,
      wind,
      models,
    };
  };

  const events: GlowEvent[] = [];
  for (const day of days) {
    if (day.sunrise !== null && day.sunriseAzimuth !== null) {
      events.push(glowEvent("sunrise", day.date, day.sunrise, day.sunriseAzimuth));
    }
    if (day.sunset !== null && day.sunsetAzimuth !== null) {
      events.push(glowEvent("sunset", day.date, day.sunset, day.sunsetAzimuth));
    }
  }

  const firstHour = days[0].start;
  const endHour = days[days.length - 1].end;
  const hours: ObserverHour[] = clouds.time.flatMap((time, index) => time >= firstHour && time < endHour
    ? [{ time, cloud: mean(MODEL_IDS.map(model => clouds.points[0][model].total[index])) }]
    : []);

  // The sky can be shown at any moment of the forecast days, so the track runs to the hour that ends them.
  const trackHours = clouds.time.flatMap((time, index) => time >= firstHour && time <= endHour ? [index] : []);
  const skyTrack = (kind: GlowEventKind, azimuth: number): SkyTrack => {
    const indexes = PATH_DISTANCES_KM.map((_, distanceIndex) => pointIndex(kind, distanceIndex));
    return {
      azimuth,
      hours: trackHours.map((hour) => {
        const time = clouds.time[hour];
        const aod = indexes.map(index => valueAt(aerosols.time, aerosols.points[index], time));
        const results = MODEL_IDS.map((model) => {
          const section = indexes.map(index => ({
            low: clouds.points[index][model].low[hour],
            mid: clouds.points[index][model].mid[hour],
            high: clouds.points[index][model].high[hour],
          }));
          return { section, ...scoreGlow({ section, aod, precipitation: clouds.points[0][model].precipitation[hour] }) };
        });
        const layer = (distance: number, pick: (layers: CloudLayers) => number) => round(mean(results.map(result => pick(result.section[distance]))));
        return {
          time,
          cover: PATH_DISTANCES_KM.map((_, distance) => [
            layer(distance, layers => layers.low),
            layer(distance, layers => layers.mid),
            layer(distance, layers => layers.high),
          ]),
          transmission: round(mean(results.map(result => result.factors.transmission))),
          aod: results[0].factors.aod,
          wet: round(1 - mean(results.map(result => result.factors.rain))),
          wind: Object.fromEntries(Object.keys(WIND_LEVELS).map(name => [name, windAt(name as WindLayer, time)])) as Record<WindLayer, Wind>,
        };
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
