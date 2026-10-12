import type { CloudLayers } from "./glow";
import type { ModelId } from "./models";
import type { CloudForecast } from "./open-meteo";
import type { GlowEvent, GlowEventKind, GlowModelResult, ObserverHour, PlaceForecast } from "./types";
import type { SunYear } from "~/lib/astro/sun";
import type { LatLon } from "~/lib/geo/coordinates";
import { moonState, nextMoonEvent, upcomingQuarters } from "~/lib/astro/moon";
import { createObserver, nextSunEvent, sunDay, sunYear } from "~/lib/astro/sun";
import { destinationPoint, roundCoordinate } from "~/lib/geo/coordinates";
import { addDays, MINUTE_MS, zonedDateKey } from "~/lib/time/zoned";
import { glowLevel, scoreGlow } from "./glow";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "./models";
import { nightOutlook } from "./night";
import { fetchAerosolForecast, fetchCloudForecast, fetchModelRuns } from "./open-meteo";
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

  const [clouds, aerosols, runs] = await Promise.all([
    fetchCloudForecast(points),
    fetchAerosolForecast(points),
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

  const glowEvent = (kind: GlowEventKind, date: string, time: number, azimuth: number): GlowEvent => {
    const scoredAt = time + (kind === "sunset" ? 1 : -1) * GLOW_PEAK_OFFSET_MINUTES * MINUTE_MS;
    const indexes = PATH_DISTANCES_KM.map((_, distanceIndex) => pointIndex(kind, distanceIndex));
    const aod = indexes.map(index => valueAt(aerosols.time, aerosols.points[index], scoredAt));

    const models = Object.fromEntries(MODEL_IDS.map((model) => {
      const section = indexes.map(index => layersAt(clouds, index, model, scoredAt));
      const precipitation = requireValueAt(clouds.time, clouds.points[0][model].precipitation, scoredAt, `${model} precipitation`);
      const result: GlowModelResult = { ...scoreGlow({ section, aod, precipitation }), section };
      return [model, result];
    })) as Record<ModelId, GlowModelResult>;

    const scores = MODEL_IDS.map(model => models[model].score);
    const score = mean(scores);
    return {
      kind,
      date,
      time,
      scoredAt,
      azimuth,
      score,
      level: glowLevel(score),
      spread: Math.max(...scores) - Math.min(...scores),
      aod: models[MODEL_IDS[0]].factors.aod,
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

  const hours: ObserverHour[] = clouds.time.map((time, index) => {
    const layer = (pick: (model: ModelId) => number) => mean(MODEL_IDS.map(pick));
    const at = (model: ModelId) => clouds.points[0][model];
    return {
      time,
      cloud: layer(model => at(model).total[index]),
      low: layer(model => at(model).low[index]),
      mid: layer(model => at(model).mid[index]),
      high: layer(model => at(model).high[index]),
      precipitation: layer(model => at(model).precipitation[index]),
      aod: valueAt(aerosols.time, aerosols.points[0], time),
    };
  });

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
    moon: {
      state: moonState(now),
      quarters: upcomingQuarters(now, 4),
      nextRise: nextMoonEvent(observer, 1, now, 2),
      nextSet: nextMoonEvent(observer, -1, now, 2),
      days: days.map(day => ({
        date: day.date,
        rise: insideDay(nextMoonEvent(observer, 1, day.start, 1), day.start, day.end),
        set: insideDay(nextMoonEvent(observer, -1, day.start, 1), day.start, day.end),
      })),
    },
    night: nightOutlook(observer, hours, now),
  };
}

/** Monthly sunrise and sunset averages for the place's current year; a year of searches, so only the detail page asks for it. */
export function placeSunYear(forecast: Pick<PlaceForecast, "lat" | "lon" | "elevation" | "timezone">, now: number): SunYear {
  const observer = createObserver(forecast.lat, forecast.lon, forecast.elevation);
  return sunYear(observer, Number(zonedDateKey(now, forecast.timezone).slice(0, 4)), forecast.timezone);
}

function insideDay(time: number | null, start: number, end: number) {
  return time !== null && time >= start && time < end ? time : null;
}
