import type { CloudLayers, GlowLevel, GlowResult } from "./glow";
import type { ModelId } from "./models";
import type { ModelRuns, Wind, WindLayer } from "./open-meteo";
import type { MoonQuarterEvent, MoonState } from "~/lib/astro/moon";
import type { SunDay } from "~/lib/astro/sun";

export type GlowEventKind = "sunrise" | "sunset";

export interface GlowModelResult extends GlowResult {
  /** Cloud layers at PATH_DISTANCES_KM toward the sun when the event is scored. */
  section: CloudLayers[];
}

export interface GlowEvent {
  kind: GlowEventKind;
  date: string;
  /** Sunrise or sunset. */
  time: number;
  /** When the glow peaks and is scored: 10 minutes before sunrise or after sunset. */
  scoredAt: number;
  azimuth: number;
  /** Mean of the cloud models. */
  score: number;
  level: GlowLevel;
  aod: number | null;
  /** Model-mean wind at each cloud layer over the observer when the glow peaks. */
  wind: Record<WindLayer, Wind>;
  models: Record<ModelId, GlowModelResult>;
}

export interface ObserverHour {
  time: number;
  /** Total cloud cover, 0–1, averaged over the cloud models that reach the hour. */
  cloud: number;
}

/** What the sky looks like toward the sunrise or sunset in one forecast hour, averaged over the cloud models that reach it. */
export interface SkyHour {
  time: number;
  /** Low, mid and high cloud cover at each of PATH_DISTANCES_KM toward the sun. */
  cover: [number, number, number][];
  /** Share of the low sunlight that gets past cloud on its way in. */
  transmission: number;
  aod: number | null;
  /** 0 when dry, toward 1 in heavy rain. */
  wet: number;
  wind: Record<WindLayer, Wind>;
}

/** The forecast sky hour by hour, looking along the sunrise or sunset azimuth. */
export interface SkyTrack {
  azimuth: number;
  hours: SkyHour[];
}

export interface MoonOutlook {
  state: MoonState;
  quarters: MoonQuarterEvent[];
  nextRise: number | null;
  nextSet: number | null;
}

export interface PlaceForecast {
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  generatedAt: number;
  runs: ModelRuns;
  days: SunDay[];
  /** Hourly from the start of the first day, as far as a cloud model reaches. */
  hours: ObserverHour[];
  /** The sunrises and sunsets every cloud model reaches, in order. */
  events: GlowEvent[];
  /** Absent where the sun neither rises nor sets in the coming days. */
  tracks: Partial<Record<GlowEventKind, SkyTrack>>;
  moon: MoonOutlook;
}
