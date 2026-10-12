export const CURVE_STEP_MINUTES = 10;

/** Sun altitudes (degrees, geometric) bounding the photographers' golden and blue hours. */
export const GOLDEN_HOUR_TOP = 6;
export const GOLDEN_HOUR_BOTTOM = -4;
export const BLUE_HOUR_BOTTOM = -6;

export type TimeRange = readonly [start: number, end: number];
