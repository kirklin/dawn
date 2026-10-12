/**
 * Cloud forecasts come from two global models; their disagreement is shown as forecast uncertainty.
 * Open-Meteo serves ECMWF's pressure-level winds only from its 0.25° open-data run.
 */
export const CLOUD_MODELS = [
  { id: "ecmwf", openMeteo: "ecmwf_ifs", winds: "ecmwf_ifs025", metadata: "ecmwf_ifs" },
  { id: "gfs", openMeteo: "gfs_seamless", winds: "gfs_seamless", metadata: "ncep_gfs013" },
] as const;

export type ModelId = (typeof CLOUD_MODELS)[number]["id"];

export const MODEL_IDS: ModelId[] = CLOUD_MODELS.map(model => model.id);

/** Distances along the sun's azimuth sampled for every glow event; 0 is the observer. */
export const PATH_DISTANCES_KM = [0, 25, 50, 100, 150, 200, 300, 400] as const;

export const FORECAST_DAYS = 4;
