export type GlyphKind
  = | "clear-day"
    | "clear-night"
    | "partly-day"
    | "partly-night"
    | "cloudy"
    | "rain"
    | "sunrise"
    | "sunset";

export function glyphFor(cloud: number, precipitation: number, isDay: boolean): GlyphKind {
  if (precipitation >= 0.2) {
    return "rain";
  }
  if (cloud < 0.2) {
    return isDay ? "clear-day" : "clear-night";
  }
  if (cloud < 0.7) {
    return isDay ? "partly-day" : "partly-night";
  }
  return "cloudy";
}
