import type { GlowEvent, GlowModelResult } from "~/lib/forecast/types";
import { localLowCover } from "~/lib/forecast/glow";
import { MODEL_IDS } from "~/lib/forecast/models";

function meanOverModels(event: GlowEvent, pick: (result: GlowModelResult) => number) {
  return MODEL_IDS.reduce((sum, model) => sum + pick(event.models[model]), 0) / MODEL_IDS.length;
}

/** The four things that make or spoil a glow, each averaged over the cloud models. */
export function glowFactors(event: GlowEvent) {
  return {
    /** Mid and high cloud near the observer, the canvas the low sun lights from below. */
    canvas: meanOverModels(event, result => result.factors.canvasCover),
    /** Share of the low sunlight that gets past cloud on its way in. */
    path: meanOverModels(event, result => result.factors.transmission),
    /** Aerosol optical depth along the light path. */
    aod: event.aod,
    /** Low cloud overhead. */
    low: meanOverModels(event, result => localLowCover(result.section)),
  };
}

export function canvasKey(cover: number) {
  return cover < 0.05 ? "none" : cover < 0.25 ? "few" : cover < 0.8 ? "some" : "full";
}

export function pathKey(transmission: number) {
  return transmission >= 0.7 ? "clear" : transmission >= 0.35 ? "partial" : "blocked";
}

export function lowKey(cover: number) {
  return cover < 0.25 ? "open" : cover < 0.6 ? "partial" : "blocked";
}
