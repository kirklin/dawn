"use client";

import type { PlaceCandidate } from "~/lib/places/geocode";
import { useEffect, useState } from "react";
import { z } from "zod";

const DEBOUNCE_MS = 300;

const resultsSchema = z.object({
  results: z.array(z.object({ name: z.string(), detail: z.string(), lat: z.number(), lon: z.number() })),
}) satisfies z.ZodType<{ results: PlaceCandidate[] }>;

export type SearchState
  = | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; results: PlaceCandidate[] }
    | { status: "error"; message: string };

type Answer = { results: PlaceCandidate[] } | { error: string };

/** Place search results for `query`, fetched once typing pauses. */
export function usePlaceSearch(query: string): SearchState {
  const trimmed = query.trim();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const answered = trimmed in answers;

  useEffect(() => {
    if (!trimmed || answered) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      let answer: Answer;
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`${response.status} ${await response.text()}`);
        }
        answer = { results: resultsSchema.parse(await response.json()).results };
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        answer = { error: error instanceof Error ? error.message : String(error) };
      }
      setAnswers(previous => ({ ...previous, [trimmed]: answer }));
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, answered]);

  if (!trimmed) {
    return { status: "idle" };
  }
  const answer = answers[trimmed];
  if (!answer) {
    return { status: "loading" };
  }
  return "error" in answer ? { status: "error", message: answer.error } : { status: "done", results: answer.results };
}
