"use client";

import type { Labels } from "../use-labels";
import type { GlowEvent } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SkyCard } from "~/components/ios/sky-card";
import { FORECAST_DAYS } from "~/lib/forecast/models";
import { ForecastSheet } from "./forecast-sheet";
import { GlowEventList } from "./glow-event-list";

/** Glows listed on the card; the sheet lists them all. */
const CARD_ROWS = 3;

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
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <SkyCard wide title={t("title")}>
      <GlowEventList
        className="mt-1.5"
        events={events.slice(0, CARD_ROWS)}
        timeZone={timeZone}
        day={event => labels.day(event.date, event.time)}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {events.length > CARD_ROWS && (
        <>
          <button type="button" onClick={() => setSheetOpen(true)} className="mt-2 h-11 w-full rounded-xl bg-white/12 text-[17px]">
            {t("more", { days: FORECAST_DAYS })}
          </button>
          <ForecastSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            events={events}
            timeZone={timeZone}
            labels={labels}
            selectedId={selectedId}
            onSelect={(event) => {
              setSheetOpen(false);
              onSelect(event);
            }}
          />
        </>
      )}
    </SkyCard>
  );
}
