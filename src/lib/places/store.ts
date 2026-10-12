import { useSyncExternalStore } from "react";
import { z } from "zod";
import { roundCoordinate } from "~/lib/geo/coordinates";

const savedPlaceSchema = z.object({
  name: z.string(),
  detail: z.string(),
  lat: z.number(),
  lon: z.number(),
});

export type SavedPlace = z.infer<typeof savedPlaceSchema>;

const locationSchema = z.object({
  enabled: z.boolean(),
  last: savedPlaceSchema.nullable(),
});

export type LocationSetting = z.infer<typeof locationSchema>;

interface Store<T> {
  read: () => T;
  write: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
  initial: T;
}

/** A localStorage entry exposed to React through useSyncExternalStore, synced across tabs. */
function localStore<T>(key: string, schema: z.ZodType<T>, initial: T): Store<T> {
  let cachedRaw: string | null = null;
  let cachedValue = initial;
  const listeners = new Set<() => void>();

  return {
    initial,
    read() {
      const raw = window.localStorage.getItem(key);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedValue = raw === null ? initial : schema.parse(JSON.parse(raw));
      }
      return cachedValue;
    },
    write(value) {
      window.localStorage.setItem(key, JSON.stringify(value));
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) {
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const placesStore = localStore<SavedPlace[]>("twilit:places", z.array(savedPlaceSchema), []);
export const locationStore = localStore<LocationSetting>("twilit:location", locationSchema, { enabled: false, last: null });

export function useStore<T>(store: Store<T>) {
  return useSyncExternalStore(store.subscribe, store.read, () => store.initial);
}

const subscribeNothing = () => () => {};

/** False during server rendering and hydration, true once the browser stores can be read. */
export function useHydrated() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

export function placeKey(place: Pick<SavedPlace, "lat" | "lon">) {
  return `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;
}

/** Coordinates kept to the 4 decimals (about 10 m) that place links carry. */
export function roundPlace(place: SavedPlace): SavedPlace {
  return { ...place, lat: roundCoordinate(place.lat, 4), lon: roundCoordinate(place.lon, 4) };
}

export function addPlace(place: SavedPlace) {
  const rounded = roundPlace(place);
  const places = placesStore.read();
  if (!places.some(existing => placeKey(existing) === placeKey(rounded))) {
    placesStore.write([...places, rounded]);
  }
}

export function removePlace(key: string) {
  placesStore.write(placesStore.read().filter(place => placeKey(place) !== key));
}

export function placeHref(place: SavedPlace, options: { current?: boolean } = {}) {
  const params = new URLSearchParams({
    lat: place.lat.toFixed(4),
    lon: place.lon.toFixed(4),
    name: place.name,
  });
  if (place.detail) {
    params.set("detail", place.detail);
  }
  if (options.current) {
    params.set("current", "1");
  }
  return `/place?${params}`;
}

export interface PlacePage {
  place: SavedPlace;
  current: boolean;
}

/** Every page the toolbar pages through: the current location first, then saved places. */
export function placePages(places: SavedPlace[], location: LocationSetting): PlacePage[] {
  const pages: PlacePage[] = places.map(place => ({ place, current: false }));
  if (location.enabled && location.last) {
    pages.unshift({ place: location.last, current: true });
  }
  return pages;
}
