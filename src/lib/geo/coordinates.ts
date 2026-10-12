export const EARTH_RADIUS_KM = 6371;

export interface LatLon {
  lat: number;
  lon: number;
}

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

export function normalizeLongitude(lon: number) {
  return ((lon + 540) % 360) - 180;
}

export function roundCoordinate(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Great-circle destination from `origin` after `distanceKm` along `bearingDeg` (0 = north, clockwise). */
export function destinationPoint(origin: LatLon, bearingDeg: number, distanceKm: number): LatLon {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(origin.lat);
  const lon1 = toRadians(origin.lon);

  const sinLat2 = Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing);
  const lat2 = Math.asin(sinLat2);
  const y = Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1);
  const x = Math.cos(angular) - Math.sin(lat1) * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return { lat: toDegrees(lat2), lon: normalizeLongitude(toDegrees(lon2)) };
}

export function distanceKm(a: LatLon, b: LatLon) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const COMPASS_POINTS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

export function compassPoint(azimuthDeg: number): CompassPoint {
  const index = Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[index];
}
