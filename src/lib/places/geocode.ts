import type { LatLon } from "~/lib/geo/coordinates";
import { z } from "zod";
import { distanceKm } from "~/lib/geo/coordinates";

const PHOTON_SEARCH = "https://photon.komoot.io/api/";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
/** Nominatim's usage policy asks every application to identify itself; stock library user agents are blocked. */
const NOMINATIM_HEADERS = { "User-Agent": "DawnKrik/0.1 (+https://github.com/kirklin/twilit)" };
const REVALIDATE_SECONDS = 24 * 3600;

/** Settlements, administrative areas and scenic features. */
const SEARCH_TAGS = [
  "place:city",
  "place:county",
  "place:town",
  "place:suburb",
  "place:state",
  "place:province",
  "place:region",
  "place:municipality",
  "place:island",
  "place:islet",
  "place:archipelago",
  "natural",
  "water:lake",
  "tourism:attraction",
  "tourism:viewpoint",
  "leisure:park",
  "leisure:nature_reserve",
  "boundary:protected_area",
  "boundary:national_park",
];
/** GeoNames feature codes of capitals and administrative seats. */
const MAJOR_CITY_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3"]);
const DUPLICATE_DISTANCE_KM = 15;

export interface PlaceCandidate {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

const photonSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    properties: z.object({
      name: z.string().optional(),
      countrycode: z.string().optional(),
      country: z.string().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
      county: z.string().optional(),
    }),
  })),
});

const openMeteoSchema = z.object({
  results: z.array(z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    feature_code: z.string(),
    country_code: z.string().optional(),
    country: z.string().optional(),
    admin1: z.string().optional(),
    admin2: z.string().optional(),
  })).optional(),
});

const geocodingSchema = z.object({
  name: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
});

/** Nominatim's geocodejson: one feature, or an error where there is nothing to name, as out at sea. */
const nominatimSchema = z.union([
  z.object({ error: z.string() }),
  z.object({
    features: z.tuple([z.object({
      properties: z.object({ geocoding: geocodingSchema }),
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    })]),
  }),
]);

async function getJson(url: URL, headers?: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers, next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) {
    throw new Error(`${url.origin}${url.pathname} responded ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/** Larger divisions first, e.g. "广东省 广州市"; foreign places are prefixed with their country. */
function detailOf(name: string, divisions: (string | undefined)[], countryCode?: string, country?: string) {
  const parts: string[] = [];
  if (countryCode && countryCode.toUpperCase() !== "CN" && country) {
    parts.push(country);
  }
  for (const division of divisions) {
    if (division && division !== name && !parts.includes(division)) {
      parts.push(division);
    }
  }
  return parts.join(" ");
}

function photonPlaces(body: z.infer<typeof photonSchema>): PlaceCandidate[] {
  return body.features.flatMap(({ geometry, properties }) => properties.name
    ? [{
        name: properties.name,
        detail: detailOf(properties.name, [properties.state, properties.city, properties.county], properties.countrycode, properties.country),
        lat: geometry.coordinates[1],
        lon: geometry.coordinates[0],
      }]
    : []);
}

async function searchPhoton(query: string) {
  const url = new URL(PHOTON_SEARCH);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  for (const tag of SEARCH_TAGS) {
    url.searchParams.append("osm_tag", tag);
  }
  return photonPlaces(photonSchema.parse(await getJson(url)));
}

async function searchMajorCities(query: string): Promise<PlaceCandidate[]> {
  const url = new URL(OPEN_METEO_GEOCODING);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");
  const body = openMeteoSchema.parse(await getJson(url));
  return (body.results ?? [])
    .filter(result => MAJOR_CITY_CODES.has(result.feature_code))
    .map(result => ({
      name: result.name,
      detail: detailOf(result.name, [result.admin1, result.admin2], result.country_code, result.country),
      lat: result.latitude,
      lon: result.longitude,
    }));
}

function isDuplicate(a: PlaceCandidate, b: PlaceCandidate) {
  const sameName = a.name.startsWith(b.name) || b.name.startsWith(a.name);
  return sameName && distanceKm(a, b) < DUPLICATE_DISTANCE_KM;
}

export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const [cities, places] = await Promise.all([searchMajorCities(query), searchPhoton(query)]);
  const merged: PlaceCandidate[] = [];
  for (const candidate of [...cities, ...places]) {
    if (!merged.some(existing => isDuplicate(existing, candidate))) {
      merged.push(candidate);
    }
  }
  return merged;
}

/** OSM keeps several variants of a name in one tag, separated by semicolons; the first is the main one. */
function firstVariant(value: string) {
  return value.split(";")[0].trim();
}

/**
 * The city a reverse geocoding falls in, or its county outside cities, e.g. "广州市" in "广东省", or "纽约" in
 * "美国 纽约州"; the name of the matched object itself when it has neither.
 */
export function placeFromGeocoding(geocoding: z.infer<typeof geocodingSchema>) {
  const { city, county, state, country, country_code: countryCode } = geocoding;
  const found = city ?? county ?? geocoding.name;
  if (!found) {
    return null;
  }
  const name = firstVariant(found);
  const divisions = [state, city ? county : undefined].map(division => division && firstVariant(division));
  return { name, detail: detailOf(name, divisions, countryCode, country && firstVariant(country)) };
}

/**
 * Names the place at `point` with OpenStreetMap's Nominatim, at city level, in Simplified Chinese where OSM has it.
 * The point is rounded to about a kilometre: enough for a city's name, and nearby lookups share the cache.
 */
export async function reversePlace(point: LatLon): Promise<PlaceCandidate | null> {
  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set("format", "geocodejson");
  url.searchParams.set("lat", point.lat.toFixed(2));
  url.searchParams.set("lon", point.lon.toFixed(2));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("accept-language", "zh-Hans,zh-CN,zh");
  const body = nominatimSchema.parse(await getJson(url, NOMINATIM_HEADERS));
  if ("error" in body) {
    return null;
  }
  const [feature] = body.features;
  const place = placeFromGeocoding(feature.properties.geocoding);
  return place && { ...place, lat: feature.geometry.coordinates[1], lon: feature.geometry.coordinates[0] };
}
