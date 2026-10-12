export const CURVE_STEP_MINUTES = 10;

/** Sun altitudes (degrees, geometric) bounding the photographers' golden and blue hours. */
export const GOLDEN_HOUR_TOP = 6;
export const GOLDEN_HOUR_BOTTOM = -4;
export const BLUE_HOUR_BOTTOM = -6;
export const NAUTICAL_TWILIGHT = -12;
export const ASTRONOMICAL_TWILIGHT = -18;

/** Moon illumination below which a crescent barely brightens the night sky. */
export const FAINT_MOON = 0.08;
/** Stargazing score from which an hour counts towards the best window of the night. */
export const BEST_HOUR_SCORE = 0.6;

export type TimeRange = readonly [start: number, end: number];
