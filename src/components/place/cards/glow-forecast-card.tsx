"use client";

import type { Labels } from "../use-labels";
import type { GlowEvent } from "~/lib/forecast/types";
import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { WeatherGlyph } from "~/components/sky/weather-glyph";
import { MODEL_IDS } from "~/lib/forecast/models";
import { eventId, GLOW_LINGER_MS } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";
import { cn } from "~/lib/utils";
import { GLOW_GRADIENT } from "../glow-style";

/** Narrowest visible bar segment, as a fraction of the 0–100% scale. */
const MIN_SEGMENT = 0.04;

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
  events: GlowEvent[];
  now: number;
  timeZone: string;
  labels: Labels;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function GlowForecastCard({ events, now, timeZone, labels, selectedId, onSelect }: GlowForecastCardProps) {
  const t = useTranslations("Place.forecast");
  const glow = useTranslations("Glow");

  return (
    <SkyCard wide title={t("title")} icon={Flame} bodyClassName="px-2 pb-2">
      <ul>
        {events.map((event) => {
          const id = eventId(event);
          const { low, high } = segment(event);
          const past = event.time + GLOW_LINGER_MS < now;
          return (
            <li key={id} className="border-t border-white/15 first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "flex h-[52px] w-full items-center gap-2 rounded-lg px-2 text-left",
                  id === selectedId && "bg-white/10",
                  past && "opacity-45",
                )}
              >
                <span className="w-11 shrink-0 text-[17px] font-medium">{labels.day(event.date, event.time)}</span>
                <WeatherGlyph kind={event.kind} className="size-6 shrink-0" />
                <span className="w-[68px] shrink-0 leading-tight">
                  <span className="block text-[15px] font-medium">{glow(`event.${event.kind}`)}</span>
                  <span className="block text-[13px] text-white/60 tabular-nums">{formatClock(event.time, timeZone)}</span>
                </span>
                <span className="relative h-[5px] flex-1 rounded-full bg-black/25">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: GLOW_GRADIENT,
                      clipPath: `inset(0 ${(1 - high) * 100}% 0 ${low * 100}% round 3px)`,
                    }}
                  />
                </span>
                <span className="w-[68px] shrink-0 text-right text-[17px] font-medium">{glow(`level.${event.level}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-2 pt-1 text-[13px] text-white/50">{t("hint")}</p>
    </SkyCard>
  );
}
