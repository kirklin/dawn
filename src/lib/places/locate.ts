import type { SavedPlace } from "./store";
import { z } from "zod";
import { roundPlace } from "./store";

export type LocateErrorReason = "denied" | "unavailable" | "timeout" | "unsupported";

export class LocateError extends Error {
  readonly reason: LocateErrorReason;

  constructor(reason: LocateErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

const REASONS: Record<number, LocateErrorReason> = { 1: "denied", 2: "unavailable", 3: "timeout" };

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new LocateError("unsupported", "Geolocation is not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      error => reject(new LocateError(REASONS[error.code], error.message)),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

const reverseSchema = z.object({
  place: z.object({ name: z.string(), detail: z.string() }).nullable(),
});

function coordinateName(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}

export async function locateCurrentPlace(): Promise<SavedPlace> {
  const { coords } = await currentPosition();
  const lat = coords.latitude;
  const lon = coords.longitude;
  const response = await fetch(`/api/places/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: ${response.status} ${await response.text()}`);
  }
  const { place } = reverseSchema.parse(await response.json());
  return roundPlace({
    name: place?.name ?? coordinateName(lat, lon),
    detail: place?.detail ?? "",
    lat,
    lon,
  });
}
