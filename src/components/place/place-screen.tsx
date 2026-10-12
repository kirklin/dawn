"use client";

import type { CSSProperties } from "react";
import type { SunYear } from "~/lib/astro/sun";
import type { GlowEvent, PlaceForecast } from "~/lib/forecast/types";
import type { SavedPlace } from "~/lib/places/store";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useNow } from "~/components/ios/use-now";
import { useScrollChrome } from "~/components/ios/use-scroll-chrome";
import { useSwipePaging } from "~/components/ios/use-swipe-paging";
import { rgbChannels, skyColors } from "~/components/sky/palette";
import { SkyBackground } from "~/components/sky/sky-background";
import { dayAt, eventId, hourAt, nextGlowEvent, nextSunCrossing, sunAltitudeAt } from "~/lib/forecast/selectors";
import { formatClock, formatScore } from "~/lib/format";
import { useRouter } from "~/lib/i18n/navigation";
import { addPlace, locationStore, placeHref, placeKey, placePages, placesStore, useHydrated, useStore } from "~/lib/places/store";
import { cn } from "~/lib/utils";
import { AerosolCard } from "./cards/aerosol-card";
import { AnalysisCard } from "./cards/analysis-card";
import { AzimuthCard } from "./cards/azimuth-card";
import { GlowForecastCard } from "./cards/glow-forecast-card";
import { GoldenHourCard } from "./cards/golden-hour-card";
import { HourlyCard } from "./cards/hourly-card";
import { LayersCard } from "./cards/layers-card";
import { MoonCard } from "./cards/moon-card";
import { NightCard } from "./cards/night-card";
import { SectionCard } from "./cards/section-card";
import { SunCard } from "./cards/sun-card";
import { PlaceFooter } from "./place-footer";
import { PlaceHero, PlaceTitleBar } from "./place-title";
import { PlaceToolbar } from "./place-toolbar";
import { MoonSheet } from "./sheets/moon-sheet";
import { SunSheet } from "./sheets/sun-sheet";
import { useLabels } from "./use-labels";
import { useSummary } from "./use-summary";

interface PlaceScreenProps {
  place: SavedPlace;
  /** The page of the device's own location. */
  current: boolean;
  /** Opened from search: offers Cancel and Add instead of the toolbar. */
  preview: boolean;
  forecast: PlaceForecast;
  year: SunYear;
  /** Server time of the render, so the first client render matches it. */
  renderedAt: number;
}

export function PlaceScreen({ place, current, preview, forecast, year, renderedAt }: PlaceScreenProps) {
  const t = useTranslations("Place");
  const glow = useTranslations("Glow");
  const router = useRouter();
  const now = useNow(renderedAt);
  const { timezone } = forecast;
  const labels = useLabels(timezone, now);

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  useScrollChrome(rootRef, barRef);

  const hydrated = useHydrated();
  const places = useStore(placesStore);
  const location = useStore(locationStore);
  const pages = placePages(places, location);
  const pageIndex = preview
    ? -1
    : pages.findIndex(page => page.current === current && (current || placeKey(page.place) === placeKey(place)));
  /** Opened from search, or from a link to a place the list does not hold: offer to add it. */
  const adding = preview || (hydrated && pageIndex === -1);
  const showPage = (index: number) => {
    const page = pages[index];
    if (page && index !== pageIndex) {
      router.replace(placeHref(page.place, { current: page.current }));
    }
  };
  useSwipePaging(rootRef, (direction) => {
    if (pageIndex >= 0) {
      showPage(pageIndex + direction);
    }
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"sun" | "moon" | null>(null);

  const nextEvent = nextGlowEvent(forecast.events, now);
  const dayOf = (event: GlowEvent) => labels.day(event.date, event.time);
  const summary = useSummary(nextEvent, nextEvent ? dayOf(nextEvent) : "");
  const selected = forecast.events.find(event => eventId(event) === selectedId) ?? nextEvent;

  const today = dayAt(forecast.days, now);
  const altitude = sunAltitudeAt(forecast.days, now);
  const hour = hourAt(forecast.hours, now);
  if (!today || altitude === null || !hour) {
    throw new Error(`The forecast made at ${new Date(forecast.generatedAt).toISOString()} no longer covers the current time`);
  }
  const colors = skyColors(altitude, hour.cloud);
  const sunKind = nextSunCrossing(forecast.days, now)?.kind ?? "sunset";

  const hero = nextEvent && {
    level: glow(`level.${nextEvent.level}`),
    day: dayOf(nextEvent),
    event: glow(`event.${nextEvent.kind}`),
    score: formatScore(nextEvent.score),
  };
  const times = today.sunrise !== null && today.sunset !== null
    ? t("heroTimes", { sunrise: formatClock(today.sunrise, timezone), sunset: formatClock(today.sunset, timezone) })
    : null;

  const addActions = adding
    ? {
        onCancel: () => router.replace("/"),
        onAdd: () => {
          addPlace(place);
          router.replace("/");
        },
      }
    : null;

  return (
    <div
      ref={rootRef}
      className={cn("relative min-h-dvh", adding ? "pb-[calc(env(safe-area-inset-bottom)+16px)]" : "pb-[calc(env(safe-area-inset-bottom)+66px)]")}
      style={{ "--scroll": 0, "--pin": "0px", "--sky-card": rgbChannels(colors.card) } as CSSProperties}
    >
      <SkyBackground altitude={altitude} cloud={hour.cloud} />
      <PlaceTitleBar
        ref={barRef}
        name={place.name}
        current={current}
        compact={hero && t("compact", hero)}
        actions={addActions}
      />
      <PlaceHero level={hero?.level ?? null} line={hero && t("heroLine", hero)} times={times} />

      <main className="mx-auto grid max-w-xl grid-cols-2 gap-3 px-4">
        <HourlyCard forecast={forecast} now={now} summary={summary} />
        {forecast.events.length > 0 && (
          <GlowForecastCard
            events={forecast.events}
            now={now}
            timeZone={timezone}
            labels={labels}
            selectedId={selected && eventId(selected)}
            onSelect={setSelectedId}
          />
        )}
        {selected && (
          <>
            <AnalysisCard event={selected} dayLabel={dayOf(selected)} />
            <LayersCard event={selected} />
            <AerosolCard aod={selected.aod} />
            <SectionCard event={selected} labels={labels} />
          </>
        )}
        <SunCard days={forecast.days} now={now} timeZone={timezone} onOpen={() => setSheet("sun")} />
        <GoldenHourCard days={forecast.days} now={now} timeZone={timezone} />
        <AzimuthCard day={today} labels={labels} />
        <MoonCard moon={forecast.moon} now={now} timeZone={timezone} onOpen={() => setSheet("moon")} />
        <NightCard night={forecast.night} timeZone={timezone} />
      </main>

      <PlaceFooter runs={forecast.runs} timeZone={timezone} />
      {!adding && <PlaceToolbar pages={pages} index={pageIndex} onSelect={showPage} />}

      <SunSheet
        open={sheet === "sun"}
        onOpenChange={open => setSheet(open ? "sun" : null)}
        kind={sunKind}
        title={glow(`sun.${sunKind}`)}
        forecast={forecast}
        year={year}
        now={now}
        labels={labels}
      />
      <MoonSheet
        open={sheet === "moon"}
        onOpenChange={open => setSheet(open ? "moon" : null)}
        moon={forecast.moon}
        timeZone={timezone}
        labels={labels}
      />
    </div>
  );
}
