import type { CloudLayers, GlowLevel, GlowResult } from "./glow";
import type { ModelId } from "./models";
import type { NightOutlook } from "./night";
import type { ModelRuns } from "./open-meteo";
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
  /** Difference between the highest and lowest model score. */
  spread: number;
  aod: number | null;
  models: Record<ModelId, GlowModelResult>;
}

export interface ObserverHour {
  time: number;
  /** Model-mean cloud cover fractions. */
  cloud: number;
  low: number;
  mid: number;
  high: number;
  precipitation: number;
  aod: number | null;
}

export interface MoonDay {
  date: string;
  rise: number | null;
  set: number | null;
}

export interface MoonOutlook {
  state: MoonState;
  quarters: MoonQuarterEvent[];
  nextRise: number | null;
  nextSet: number | null;
  days: MoonDay[];
}

export interface PlaceForecast {
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  generatedAt: number;
  runs: ModelRuns;
  days: SunDay[];
  hours: ObserverHour[];
  events: GlowEvent[];
  moon: MoonOutlook;
  night: NightOutlook | null;
}
