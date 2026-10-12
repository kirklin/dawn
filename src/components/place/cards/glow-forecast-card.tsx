"use client";

import type { Labels } from "../use-labels";
import type { GlowEvent } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SkyCard } from "~/components/ios/sky-card";
import { SunGlyph } from "~/components/sky/sun-glyph";
import { MODEL_IDS } from "~/lib/forecast/models";
import { eventId } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";
import { cn } from "~/lib/utils";
import { GLOW_GRADIENT } from "../glow-style";

/** Narrowest visible bar segment, as a fraction of the 0–100% scale. */
const MIN_SEGMENT = 0.04;
/** Glows listed until the card is expanded. */
const COLLAPSED_ROWS = 3;

/** The bar spans the scores of the two cloud models, so its length shows how far they agree. */
function segment(event: GlowEvent) {
  const scores = MODEL_IDS.map(model => event.models[model].score);
  let low = Math.min(...scores);
  let high = Math.max(...scores);
  if (high - low < MIN_SEGMENT) {
    const middle = Math.min(1 - MIN_SEGMENT / 2, Math.max(MIN_SEGMENT / 2, (low + high) / 2));
    low = middle - MIN_SEGMENT / 2;
    high = middle + MIN_SEGMENT / 2;
  }
  return { low, high };
}

interface GlowForecastCardProps {
  /** The sunrises and sunsets still to come. */
  events: GlowEvent[];
  timeZone: string;
  labels: Labels;
  selectedId: string | null;
  onSelect: (event: GlowEvent) => void;
}

export function GlowForecastCard({ events, timeZone, labels, selectedId, onSelect }: GlowForecastCardProps) {
  const t = useTranslations("Place.forecast");
  const glow = useTranslations("Glow");
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events.slice(0, COLLAPSED_ROWS);

  return (
    <SkyCard wide title={t("title")}>
      <ul className="-mx-2 mt-1.5">
        {shown.map((event) => {
          const id = eventId(event);
          const { low, high } = segment(event);
          return (
            <li
              key={id}
              className="relative before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-white/15 first:before:hidden"
            >
              <button
                type="button"
                onClick={() => onSelect(event)}
                aria-pressed={id === selectedId}
                className={cn("flex h-[52px] w-full items-center gap-2.5 rounded-xl px-2 text-left text-[17px]", id === selectedId && "bg-white/10")}
              >
                <span className="w-9 shrink-0">{labels.day(event.date, event.time)}</span>
                <SunGlyph kind={event.kind} className="size-6 shrink-0" />
                <span className="w-[88px] shrink-0 tabular-nums">
                  {t("event", { event: glow(`event.${event.kind}`), time: formatClock(event.time, timeZone) })}
                </span>
                <span className="relative h-1.5 flex-1 rounded-full bg-black/25">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: GLOW_GRADIENT, clipPath: `inset(0 ${(1 - high) * 100}% 0 ${low * 100}% round 999px)` }}
                  />
                </span>
                <span className="w-[70px] shrink-0 text-right">{glow(`level.${event.level}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {events.length > COLLAPSED_ROWS && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 h-11 w-full rounded-xl bg-white/12 text-[17px]">
          {expanded ? t("collapse") : t("expand", { count: events.length })}
        </button>
      )}
    </SkyCard>
  );
}
