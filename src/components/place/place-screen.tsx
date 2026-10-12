"use client";

import type { CSSProperties } from "react";
import type { HeroContent } from "./place-title";
import type { TimeRange } from "~/lib/astro/constants";
import type { SunYear } from "~/lib/astro/sun";
import type { GlowEvent, PlaceForecast } from "~/lib/forecast/types";
import type { SavedPlace } from "~/lib/places/store";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { useNow } from "~/components/ios/use-now";
import { useScrollChrome } from "~/components/ios/use-scroll-chrome";
import { useSwipePaging } from "~/components/ios/use-swipe-paging";
import { ForecastSky } from "~/components/sky/forecast-sky";
import { rgbChannels, skyColors } from "~/components/sky/palette";
import { quietSkyParams, skyParams } from "~/components/sky/sky-params";
import { dayAt, eventId, GLOW_LINGER_MS, nextGlowEvent, nextSunCrossing } from "~/lib/forecast/selectors";
import { formatClock, formatScore } from "~/lib/format";
import { useRouter } from "~/lib/i18n/navigation";
import { addPlace, locationStore, placeHref, placeKey, placePages, placesStore, useHydrated, useStore } from "~/lib/places/store";
import { DAY_MS } from "~/lib/time/zoned";
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
  const cardsRef = useRef<HTMLElement>(null);
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
  if (!today) {
    throw new Error(`The forecast made at ${new Date(forecast.generatedAt).toISOString()} no longer covers the current time`);
  }
  const sunKind = nextSunCrossing(forecast.days, now)?.kind ?? "sunset";

  const sky = useMemo(
    () => (selected ? skyParams(selected, forecast) : quietSkyParams(forecast.lat, forecast.lon)),
    [selected, forecast],
  );
  const [low, mid, high] = sky.cover[0];
  const tint = skyColors(sky.sun * (180 / Math.PI), 1 - (1 - low) * (1 - mid) * (1 - high));

  let hero: HeroContent | null = null;
  let compact: string | null = null;
  if (selected) {
    const level = glow(`level.${selected.level}`);
    const event = glow(`event.${selected.kind}`);
    const until = selected.time - now;
    let heading = t("hero.heading", { day: dayOf(selected), event, time: formatClock(selected.time, timezone) });
    if (until > 0 && until < DAY_MS) {
      heading += ` · ${t("hero.countdown", { duration: labels.duration(until) })}`;
    } else if (until <= 0 && until > -GLOW_LINGER_MS) {
      heading += ` · ${t("hero.now")}`;
    }

    const day = forecast.days.find(entry => entry.date === selected.date);
    if (!day) {
      throw new Error(`No sun day for the glow event on ${selected.date}`);
    }
    const range = (value: TimeRange | null) =>
      value ? `${formatClock(value[0], timezone)}–${formatClock(value[1], timezone)}` : "--";
    const golden = { label: t("golden.golden"), value: range(selected.kind === "sunset" ? day.goldenEvening : day.goldenMorning) };
    const blue = { label: t("golden.blue"), value: range(selected.kind === "sunset" ? day.blueEvening : day.blueMorning) };

    hero = {
      heading,
      level,
      score: selected.score,
      meter: t("hero.meter", { score: formatScore(selected.score) }),
      models: t("analysis.models", { ecmwf: formatScore(selected.models.ecmwf.score), gfs: formatScore(selected.models.gfs.score) }),
      facts: [
        { label: t("hero.direction"), value: labels.azimuth(selected.azimuth) },
        ...(selected.kind === "sunset" ? [golden, blue] : [blue, golden]),
      ],
    };
    compact = t("compact", { level, day: dayOf(selected), event });
  }

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
      style={{ "--scroll": 0, "--pin": "0px", "--sky-card": rgbChannels(tint.card) } as CSSProperties}
    >
      <ForecastSky params={sky} fallback={tint} horizonRef={cardsRef} />
      <PlaceTitleBar ref={barRef} name={place.name} current={current} compact={compact} actions={addActions} />
      <PlaceHero content={hero} />

      <main ref={cardsRef} className="mx-auto grid max-w-xl grid-cols-2 gap-3 px-4">
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
