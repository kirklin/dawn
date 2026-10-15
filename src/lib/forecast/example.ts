import type { CloudLayers } from "./glow";
import type { ModelId } from "./models";
import type { AerosolForecast, CloudForecast, ModelHours, Wind, WindForecast, WindLayer } from "./open-meteo";
import type { GlowEventKind, PlaceForecast } from "./types";
import type { SavedPlace } from "~/lib/places/store";
import { createObserver, sunDay } from "~/lib/astro/sun";
import { addDays, HOUR_MS, zonedDateKey, zonedMidnight } from "~/lib/time/zoned";
import { FORECAST_DAYS, MODEL_IDS, PATH_DISTANCES_KM } from "./models";
import { buildPlaceForecast, forecastSampling } from "./place-forecast";
import { GLOW_LINGER_MS } from "./selectors";

/** Shown to someone who has no place of their own yet. */
export const EXAMPLE_PLACE: SavedPlace = { name: "广州", detail: "广东省", lat: 23.1291, lon: 113.2644 };

const TIMEZONE = "Asia/Shanghai";
const ELEVATION = 21;

/** The clouds of one glow along the path toward the sun. */
interface Scenario {
  /** Mid and high cloud over the place and out to 100 km, thinning beyond. */
  canvas: number;
  /** Mid cloud from 150 km toward the sun, which shades the canvas from the low sunlight. */
  farMid: number;
  /** Low cloud over the place and 25 km out, and further along the path. */
  localLow: number;
  pathLow: number;
  aod: number;
  /** mm per hour at the place. */
  rain: number;
  /** Share of the canvas that GFS has, so the two models differ a little. */
  gfsCanvas: number;
}

const SCENARIOS = {
  large: { canvas: 0.25, farMid: 0.05, localLow: 0.05, pathLow: 0.03, aod: 0.15, rain: 0, gfsCanvas: 0.85 },
  medium: { canvas: 0.3, farMid: 0.15, localLow: 0.15, pathLow: 0.18, aod: 0.3, rain: 0, gfsCanvas: 0.8 },
  small: { canvas: 0.1, farMid: 0.03, localLow: 0.1, pathLow: 0.1, aod: 0.35, rain: 0, gfsCanvas: 0.8 },
  faint: { canvas: 0.5, farMid: 0.45, localLow: 0.35, pathLow: 0.45, aod: 0.4, rain: 0, gfsCanvas: 0.9 },
  none: { canvas: 0.6, farMid: 0.6, localLow: 0.85, pathLow: 0.8, aod: 0.35, rain: 1.2, gfsCanvas: 0.9 },
} satisfies Record<string, Scenario>;

type ScenarioName = keyof typeof SCENARIOS;

/** The glow that comes next is a large one; the ones after it run through this, over and over. */
const AFTER_FEATURED: ScenarioName[] = ["small", "faint", "medium", "none", "small", "medium", "faint", "small", "none"];

/** Wind at the cloud layers, from the west-southwest as it often is over South China in autumn. */
const WIND: Record<WindLayer, Wind> = {
  low: { east: 3.5, north: 1.5 },
  mid: { east: 8, north: 3 },
  high: { east: 18, north: 6 },
};

/** The clouds stay as they are this long either side of a sunrise or sunset, and change in between. */
const HOLD_MS = 2 * HOUR_MS;

function section(scenario: Scenario, model: ModelId): CloudLayers[] {
  const canvas = scenario.canvas * (model === "gfs" ? scenario.gfsCanvas : 1);
  return PATH_DISTANCES_KM.map(distance => ({
    low: distance <= 25 ? scenario.localLow : scenario.pathLow,
    mid: distance <= 50 ? canvas : distance <= 100 ? 0.8 * canvas : scenario.farMid,
    high: canvas * (distance <= 100 ? 1 : distance <= 150 ? 0.7 : distance <= 200 ? 0.5 : 0.35),
  }));
}

interface Anchor {
  time: number;
  value: number;
}

/** Each anchor's value held for HOLD_MS either side of it, blended linearly from one to the next. */
function hourly(time: number[], anchors: Anchor[]) {
  return time.map((at) => {
    const next = anchors.findIndex(anchor => anchor.time + HOLD_MS >= at);
    if (next === -1) {
      return anchors[anchors.length - 1].value;
    }
    const anchor = anchors[next];
    if (next === 0 || at >= anchor.time - HOLD_MS) {
      return anchor.value;
    }
    const before = anchors[next - 1];
    const from = before.time + HOLD_MS;
    const to = anchor.time - HOLD_MS;
    return before.value + (anchor.value - before.value) * (at - from) / (to - from);
  });
}

/**
 * A made-up forecast for Guangzhou whose next sunrise or sunset is a large glow, rated and drawn by the
 * same code as a real one. Its days start today, so it opens on a glow at any time.
 */
export function getExampleForecast(now = Date.now()): PlaceForecast {
  const sampling = forecastSampling(EXAMPLE_PLACE, now);
  const { origin, pathStart } = sampling;
  const today = zonedDateKey(now, TIMEZONE);
  const start = zonedMidnight(today, TIMEZONE);
  // As many hours as Open-Meteo serves: the forecast days and one more.
  const time = Array.from({ length: (FORECAST_DAYS + 1) * 24 }, (_, hour) => start + hour * HOUR_MS);

  const observer = createObserver(origin.lat, origin.lon, ELEVATION);
  const crossings = Array.from({ length: FORECAST_DAYS + 1 }, (_, index) => sunDay(observer, addDays(today, index), TIMEZONE))
    .flatMap(day => (["sunrise", "sunset"] as const).flatMap((kind) => {
      const at = day[kind];
      return at === null ? [] : [{ kind, time: at }];
    }));
  const featured = crossings.findIndex(crossing => crossing.time + GLOW_LINGER_MS > now);
  const glows = crossings.map((crossing, index) => {
    const name: ScenarioName = index === featured
      ? "large"
      : index < featured ? "small" : AFTER_FEATURED[(index - featured - 1) % AFTER_FEATURED.length];
    const scenario = SCENARIOS[name];
    return {
      ...crossing,
      scenario,
      sections: Object.fromEntries(MODEL_IDS.map(model => [model, section(scenario, model)])) as Record<ModelId, CloudLayers[]>,
    };
  });

  /** Which glows a point's clouds belong to, and how far toward the sun it lies. */
  const paths = sampling.points.map((_, index) => {
    if (index === 0) {
      return { kinds: ["sunrise", "sunset"] as GlowEventKind[], distance: 0 };
    }
    for (const kind of ["sunset", "sunrise"] as const) {
      const first = pathStart[kind];
      if (first !== undefined && index >= first && index < first + PATH_DISTANCES_KM.length - 1) {
        return { kinds: [kind], distance: index - first + 1 };
      }
    }
    throw new Error(`Point ${index} lies on no path`);
  });
  const along = (kinds: GlowEventKind[], value: (glow: (typeof glows)[number]) => number) =>
    hourly(time, glows.filter(glow => kinds.includes(glow.kind)).map(glow => ({ time: glow.time, value: value(glow) })));

  const rain = along(["sunrise", "sunset"], glow => glow.scenario.rain);
  const clouds: CloudForecast = {
    timezone: TIMEZONE,
    elevation: ELEVATION,
    time,
    points: paths.map(path => Object.fromEntries(MODEL_IDS.map((model) => {
      const layer = (pick: (layers: CloudLayers) => number) => along(path.kinds, glow => pick(glow.sections[model][path.distance]));
      const low = layer(layers => layers.low);
      const mid = layer(layers => layers.mid);
      const high = layer(layers => layers.high);
      const hours: ModelHours = {
        total: low.map((cover, hour) => 1 - (1 - cover) * (1 - mid[hour]) * (1 - high[hour])),
        low,
        mid,
        high,
        precipitation: rain,
      };
      return [model, hours];
    })) as Record<ModelId, ModelHours>),
  };
  const aerosols: AerosolForecast = {
    time,
    points: paths.map(path => along(path.kinds, glow => glow.scenario.aod)),
  };
  const winds: WindForecast = {
    time,
    models: Object.fromEntries(MODEL_IDS.map(model => [
      model,
      Object.fromEntries(Object.entries(WIND).map(([layer, wind]) => [layer, { east: time.map(() => wind.east), north: time.map(() => wind.north) }])),
    ])) as WindForecast["models"],
  };

  return buildPlaceForecast(sampling, { clouds, aerosols, winds, runs: null }, now);
}
