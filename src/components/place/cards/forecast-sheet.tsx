"use client";

import type { Labels } from "../use-labels";
import type { GlowEvent } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { Drawer } from "vaul";
import { FORECAST_DAYS } from "~/lib/forecast/models";
import { GlowEventList } from "./glow-event-list";

interface ForecastSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sunrises and sunsets still to come. */
  events: GlowEvent[];
  timeZone: string;
  labels: Labels;
  selectedId: string | null;
  onSelect: (event: GlowEvent) => void;
}

/** Every glow of the forecast days in a sheet from the bottom, grouped by day. */
export function ForecastSheet({ open, onOpenChange, events, timeZone, labels, selectedId, onSelect }: ForecastSheetProps) {
  const t = useTranslations("Place.forecast");

  const days: { date: string; events: GlowEvent[] }[] = [];
  for (const event of events) {
    const last = days.at(-1);
    if (last?.date === event.date) {
      last.events.push(event);
    } else {
      days.push({ date: event.date, events: [event] });
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-xl flex-col rounded-t-[22px] bg-[rgb(28_28_30/0.9)] text-white outline-none backdrop-blur-2xl"
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-white/30" />
          <Drawer.Title className="px-6 pt-3 pb-1 text-[20px] font-semibold">{t("sheet", { days: FORECAST_DAYS })}</Drawer.Title>
          <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {days.map(day => (
              <section key={day.date}>
                <h3 className="px-2 pt-4 pb-1 text-[15px] text-white/60">{labels.heading(day.date, day.events[0].time)}</h3>
                <GlowEventList events={day.events} timeZone={timeZone} selectedId={selectedId} onSelect={onSelect} />
              </section>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
