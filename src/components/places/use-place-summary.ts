"use client";

import type { PlaceSummary } from "~/lib/forecast/summary";
import type { SavedPlace } from "~/lib/places/store";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GLOW_LEVELS } from "~/lib/forecast/glow";
import { placeKey } from "~/lib/places/store";

/** Summaries stay fresh this long, so going back to the list does not refetch every place. */
const FRESH_MS = 10 * 60_000;

const summarySchema = z.object({
  timezone: z.string(),
  sunAltitude: z.number().nullable(),
  cloud: z.number().nullable(),
  sunrise: z.number().nullable(),
  sunset: z.number().nullable(),
  nextEvent: z.object({
    kind: z.enum(["sunrise", "sunset"]),
    date: z.string(),
    time: z.number(),
    score: z.number(),
    level: z.enum(GLOW_LEVELS.map(entry => entry.level)),
  }).nullable(),
}) satisfies z.ZodType<PlaceSummary>;

const cache = new Map<string, { at: number; summary: Promise<PlaceSummary> }>();

async function fetchSummary(place: SavedPlace) {
  const response = await fetch(`/api/forecast/summary?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return summarySchema.parse(await response.json());
}

function loadSummary(place: SavedPlace) {
  const key = placeKey(place);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < FRESH_MS) {
    return cached.summary;
  }
  const summary = fetchSummary(place);
  cache.set(key, { at: Date.now(), summary });
  summary.catch(() => cache.delete(key));
  return summary;
}

export type SummaryState = { summary: PlaceSummary } | { error: string } | null;

/** The list cell's forecast summary for `place`; null while it loads. */
export function usePlaceSummary(place: SavedPlace): SummaryState {
  const key = placeKey(place);
  const [states, setStates] = useState<Record<string, Exclude<SummaryState, null>>>({});

  useEffect(() => {
    let active = true;
    loadSummary(place).then(
      summary => active && setStates(previous => ({ ...previous, [key]: { summary } })),
      (error: unknown) => active && setStates(previous => ({ ...previous, [key]: { error: error instanceof Error ? error.message : String(error) } })),
    );
    return () => {
      active = false;
    };
  }, [key, place]);

  return states[key] ?? null;
}
