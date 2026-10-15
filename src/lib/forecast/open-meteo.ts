import type { ModelId } from "./models";
import type { LatLon } from "~/lib/geo/coordinates";
import { z } from "zod";
import { CLOUD_MODELS, FORECAST_DAYS } from "./models";

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";
const FORECAST_REVALIDATE_SECONDS = 30 * 60;
const METADATA_REVALIDATE_SECONDS = 10 * 60;

const CLOUD_VARIABLES = ["cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "precipitation"] as const;

/**
 * Open-Meteo starts its hours at local midnight of its own today, and a response cached before
 * midnight is still served once after it; one extra day, the most the API serves, keeps the last
 * forecast day in the response.
 */
const FETCH_DAYS = String(FORECAST_DAYS + 1);

/** The air quality API serves at most seven days; the CAMS run itself reaches five. */
const AIR_QUALITY_DAYS = "7";

const hourlySchema = z.object({ time: z.array(z.number()) }).catchall(z.array(z.number().nullable()));

const pointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number(),
  timezone: z.string(),
  hourly: hourlySchema,
});

const airQualityPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: hourlySchema,
});

/** Open-Meteo answers a single coordinate with an object and several with an array. */
function pointsOf<T extends z.ZodType>(schema: T) {
  return z.union([z.array(schema), schema]).transform(value => (Array.isArray(value) ? value : [value]) as z.infer<T>[]);
}

const metadataSchema = z.object({ last_run_initialisation_time: z.number() });

async function getJson(url: URL, revalidate: number): Promise<unknown> {
  const response = await fetch(url, { next: { revalidate } });
  if (!response.ok) {
    throw new Error(`${url.origin}${url.pathname} responded ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function coordinateParams(points: LatLon[]) {
  return {
    latitude: points.map(point => point.lat.toFixed(2)).join(","),
    longitude: points.map(point => point.lon.toFixed(2)).join(","),
  };
}

/**
 * A model's hourly series. Open-Meteo fills the hours past the end of the model's run with null; a null
 * before the last value is a broken response.
 */
export function modelSeries(hourly: z.infer<typeof hourlySchema>, key: string) {
  const series = hourly[key];
  if (!series) {
    throw new Error(`Open-Meteo response is missing ${key}`);
  }
  const end = series.findLastIndex(value => value !== null) + 1;
  if (end === 0) {
    throw new Error(`Open-Meteo returned no ${key}`);
  }
  const gap = series.indexOf(null);
  if (gap !== -1 && gap < end) {
    throw new Error(`Open-Meteo returned no ${key} for hour ${gap}`);
  }
  return series;
}

export interface ModelHours {
  /** Cloud cover fractions, 0–1; null past the end of the model's run, as below. */
  total: (number | null)[];
  low: (number | null)[];
  mid: (number | null)[];
  high: (number | null)[];
  /** mm per hour. */
  precipitation: (number | null)[];
}

export interface CloudForecast {
  timezone: string;
  elevation: number;
  /** Epoch milliseconds of every hourly step, starting at local midnight today. */
  time: number[];
  points: Record<ModelId, ModelHours>[];
}

export async function fetchCloudForecast(points: LatLon[]): Promise<CloudForecast> {
  const url = new URL(FORECAST_ENDPOINT);
  url.search = new URLSearchParams({
    ...coordinateParams(points),
    hourly: CLOUD_VARIABLES.join(","),
    models: CLOUD_MODELS.map(model => model.openMeteo).join(","),
    forecast_days: FETCH_DAYS,
    timezone: "auto",
    timeformat: "unixtime",
  }).toString();

  const body = pointsOf(pointSchema).parse(await getJson(url, FORECAST_REVALIDATE_SECONDS));
  if (body.length !== points.length) {
    throw new Error(`Open-Meteo returned ${body.length} forecasts for ${points.length} coordinates`);
  }

  const percent = (values: (number | null)[]) => values.map(value => value === null ? null : value / 100);
  return {
    timezone: body[0].timezone,
    elevation: body[0].elevation,
    time: body[0].hourly.time.map(seconds => seconds * 1000),
    points: body.map(point => Object.fromEntries(CLOUD_MODELS.map(model => [model.id, {
      total: percent(modelSeries(point.hourly, `cloud_cover_${model.openMeteo}`)),
      low: percent(modelSeries(point.hourly, `cloud_cover_low_${model.openMeteo}`)),
      mid: percent(modelSeries(point.hourly, `cloud_cover_mid_${model.openMeteo}`)),
      high: percent(modelSeries(point.hourly, `cloud_cover_high_${model.openMeteo}`)),
      precipitation: modelSeries(point.hourly, `precipitation_${model.openMeteo}`),
    }])) as Record<ModelId, ModelHours>),
  };
}

/** Pressure levels (hPa) whose wind carries the low, mid and high cloud layers. */
export const WIND_LEVELS = { low: 850, mid: 600, high: 300 } as const;

export type WindLayer = keyof typeof WIND_LEVELS;

/** Where the air moves, m/s toward the east and toward the north. */
export interface Wind {
  east: number;
  north: number;
}

/** Hourly wind at one layer, m/s toward the east and toward the north; null past the end of the model's run. */
export interface WindSeries {
  east: (number | null)[];
  north: (number | null)[];
}

export interface WindForecast {
  time: number[];
  models: Record<ModelId, Record<WindLayer, WindSeries>>;
}

/** Hourly wind at the cloud layers over one point. */
export async function fetchWindForecast(point: LatLon): Promise<WindForecast> {
  const levels = Object.values(WIND_LEVELS);
  const url = new URL(FORECAST_ENDPOINT);
  url.search = new URLSearchParams({
    ...coordinateParams([point]),
    hourly: levels.flatMap(level => [`wind_speed_${level}hPa`, `wind_direction_${level}hPa`]).join(","),
    models: CLOUD_MODELS.map(model => model.winds).join(","),
    forecast_days: FETCH_DAYS,
    wind_speed_unit: "ms",
    timezone: "auto",
    timeformat: "unixtime",
  }).toString();

  const [body] = pointsOf(pointSchema).parse(await getJson(url, FORECAST_REVALIDATE_SECONDS));
  const winds = (model: string, level: number): WindSeries => {
    const speeds = modelSeries(body.hourly, `wind_speed_${level}hPa_${model}`);
    const directions = modelSeries(body.hourly, `wind_direction_${level}hPa_${model}`);
    // Meteorological direction is where the wind blows from.
    const component = (along: (from: number) => number) => speeds.map((speed, index) => {
      const direction = directions[index];
      return speed === null || direction === null ? null : -speed * along(direction * (Math.PI / 180));
    });
    return { east: component(Math.sin), north: component(Math.cos) };
  };
  return {
    time: body.hourly.time.map(seconds => seconds * 1000),
    models: Object.fromEntries(CLOUD_MODELS.map(model => [
      model.id,
      Object.fromEntries(Object.entries(WIND_LEVELS).map(([layer, level]) => [layer, winds(model.winds, level)])),
    ])) as WindForecast["models"],
  };
}

export interface AerosolForecast {
  time: number[];
  /** Aerosol optical depth at 550 nm from CAMS; null beyond the CAMS run. */
  points: (number | null)[][];
}

export async function fetchAerosolForecast(points: LatLon[]): Promise<AerosolForecast> {
  const url = new URL(AIR_QUALITY_ENDPOINT);
  url.search = new URLSearchParams({
    ...coordinateParams(points),
    hourly: "aerosol_optical_depth",
    domains: "cams_global",
    forecast_days: AIR_QUALITY_DAYS,
    timezone: "auto",
    timeformat: "unixtime",
  }).toString();

  const body = pointsOf(airQualityPointSchema).parse(await getJson(url, FORECAST_REVALIDATE_SECONDS));
  if (body.length !== points.length) {
    throw new Error(`Open-Meteo returned ${body.length} aerosol forecasts for ${points.length} coordinates`);
  }

  return {
    time: body[0].hourly.time.map(seconds => seconds * 1000),
    points: body.map((point) => {
      const series = point.hourly.aerosol_optical_depth;
      if (!series) {
        throw new Error("Open-Meteo response is missing aerosol_optical_depth");
      }
      return series;
    }),
  };
}

/** Initialisation time (epoch ms) of the model runs behind the forecast. */
export type ModelRuns = Record<ModelId | "cams", number>;

async function lastRun(url: string) {
  const metadata = metadataSchema.parse(await getJson(new URL(url), METADATA_REVALIDATE_SECONDS));
  return metadata.last_run_initialisation_time * 1000;
}

export async function fetchModelRuns(): Promise<ModelRuns> {
  const [cams, ...clouds] = await Promise.all([
    lastRun("https://air-quality-api.open-meteo.com/data/cams_global/static/meta.json"),
    ...CLOUD_MODELS.map(model => lastRun(`https://api.open-meteo.com/data/${model.metadata}/static/meta.json`)),
  ]);
  return {
    cams,
    ...Object.fromEntries(CLOUD_MODELS.map((model, index) => [model.id, clouds[index]])),
  } as ModelRuns;
}
