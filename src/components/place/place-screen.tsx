"use client";

import type { CSSProperties } from "react";
import type { PlaceForecast } from "~/lib/forecast/types";
import type { SavedPlace } from "~/lib/places/store";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNow } from "~/components/ios/use-now";
import { useScrollChrome } from "~/components/ios/use-scroll-chrome";
import { useSwipePaging } from "~/components/ios/use-swipe-paging";
import { ForecastSky } from "~/components/sky/forecast-sky";
import { skyColors } from "~/components/sky/palette";
import { glowMoment, skyParamsAt } from "~/components/sky/sky-params";
import { dayAt, eventId, GLOW_LINGER_MS, lightPhaseAt, nearestEvent, nextSunCrossing, sunAltitudeAt, sunPathRange } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";
import { useRouter } from "~/lib/i18n/navigation";
import { addPlace, locationStore, placeHref, placeKey, placePages, placesStore, useHydrated, useStore } from "~/lib/places/store";
import { zonedDateKey } from "~/lib/time/zoned";
import { FactorCards } from "./cards/factor-cards";
import { GlowForecastCard } from "./cards/glow-forecast-card";
import { LightCard } from "./cards/light-card";
import { MoonCard } from "./cards/moon-card";
import { PlaceFooter } from "./place-footer";
import { PlaceHero, PlaceTitleBar } from "./place-title";
import { PlaceToolbar } from "./place-toolbar";
import { scrubbedStore } from "./scrubbed-store";
import { SunPath } from "./sun-path";
import { useLabels } from "./use-labels";

interface PlaceScreenProps {
  place: SavedPlace;
  /** The page of the device's own location. */
  current: boolean;
  forecast: PlaceForecast;
  /** Server time of the render, so the first client render matches it. */
  renderedAt: number;
}

export function PlaceScreen({ place, current, forecast, renderedAt }: PlaceScreenProps) {
  const t = useTranslations("Place");
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
  const pageIndex = pages.findIndex(page => page.current === current && (current || placeKey(page.place) === placeKey(place)));
  /** Opened from search, or from a link to a place the list does not hold. */
  const unsaved = hydrated && pageIndex === -1;
  const add = () => {
    addPlace(place);
    toast(t("toolbar.added", { name: place.name }));
  };
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

  /** The moment the sky shows; null follows the clock. */
  const [chosen, setChosen] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbed = useStore(scrubbedStore);
  const time = chosen ?? now;
  const day = dayAt(forecast.days, time);
  if (!day) {
    throw new Error(`The forecast made at ${new Date(forecast.generatedAt).toISOString()} does not cover ${new Date(time).toISOString()}`);
  }

  const sky = useMemo(() => skyParamsAt(forecast, time), [forecast, time]);
  const [low, mid, high] = sky.cover[0];
  const fallback = skyColors(sky.sun * (180 / Math.PI), 1 - (1 - low) * (1 - mid) * (1 - high));

  const altitude = sunAltitudeAt(forecast.days, time) ?? 0;
  const phase = t(`hero.phase.${lightPhaseAt(altitude)}`);
  const next = chosen === null ? nextSunCrossing(forecast.days, now) : null;
  const context = next
    ? t(next.kind === "sunrise" ? "hero.untilSunrise" : "hero.untilSunset", { duration: labels.duration(next.time - now) })
    : t(zonedDateKey(time, timezone) === zonedDateKey(now, timezone) ? "hero.momentToday" : "hero.moment", {
        day: labels.day(day.date, time),
        phase,
        altitude: Math.round(altitude),
      });
  const clock = formatClock(time, timezone);

  const upcoming = forecast.events.filter(event => event.time + GLOW_LINGER_MS > now);
  /** The details follow the next glow, or the one nearest a chosen moment. */
  const selected = chosen === null ? upcoming[0] ?? null : nearestEvent(forecast.events, chosen);

  return (
    <div
      ref={rootRef}
      className="relative min-h-dvh pb-[calc(env(safe-area-inset-bottom)+72px)]"
      style={{ "--scroll": 0, "--pin": "0px" } as CSSProperties}
    >
      <ForecastSky params={sky} instant={scrubbing} fallback={fallback} horizonRef={cardsRef} />
      <PlaceTitleBar ref={barRef} name={place.name} current={current} compact={t("compact", { time: clock, phase })} />
      <PlaceHero time={clock} context={context} onNow={chosen === null ? null : () => setChosen(null)}>
        <SunPath
          day={day}
          range={sunPathRange(day)}
          time={time}
          timeZone={timezone}
          hint={hydrated && !scrubbed}
          onScrub={(moment) => {
            setScrubbing(true);
            setChosen(moment);
            if (!scrubbed) {
              scrubbedStore.write(true);
            }
          }}
          onScrubEnd={() => setScrubbing(false)}
        />
      </PlaceHero>

      <main ref={cardsRef} className="mx-auto grid max-w-xl grid-cols-2 gap-3 px-4">
        {upcoming.length > 0 && (
          <GlowForecastCard
            events={upcoming}
            timeZone={timezone}
            labels={labels}
            selectedId={selected && eventId(selected)}
            onSelect={(event) => {
              setScrubbing(false);
              setChosen(glowMoment(event));
            }}
          />
        )}
        {selected && (
          <>
            <FactorCards event={selected} />
            <LightCard event={selected} days={forecast.days} timeZone={timezone} labels={labels} />
          </>
        )}
        <MoonCard moon={forecast.moon} now={now} timeZone={timezone} />
      </main>

      <PlaceFooter runs={forecast.runs} timeZone={timezone} />
      <PlaceToolbar pages={pages} index={pageIndex} onSelect={showPage} onAdd={unsaved ? add : null} name={place.name} />
    </div>
  );
}
