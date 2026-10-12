"use client";

import { Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { locationStore, placeKey, placesStore, removePlace, useHydrated, useStore } from "~/lib/places/store";
import { cn } from "~/lib/utils";
import { PlaceCell } from "./place-cell";
import { SearchField } from "./search-field";
import { SearchResults } from "./search-results";
import { useLocate } from "./use-locate";
import { usePlaceSearch } from "./use-place-search";

function LocationRow({ locating, onLocate }: { locating: boolean; onLocate: () => void }) {
  const t = useTranslations("Places");

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#1c1c1e] px-4 py-3.5">
      <Navigation className="size-5 shrink-0 fill-[#0a84ff] text-[#0a84ff]" strokeWidth={0} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold">{t("myLocation")}</p>
        <p className="text-[13px] text-white/60">{t("locateHint")}</p>
      </div>
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="h-8 shrink-0 rounded-full bg-[#0a84ff] px-3.5 text-[15px] font-semibold disabled:opacity-60"
      >
        {locating ? t("locating") : t("locate")}
      </button>
    </div>
  );
}

/** The list of places, like the iOS Weather location list: search on top, my location first. */
export function PlacesScreen() {
  const t = useTranslations("Places");
  const footer = useTranslations("Place.footer");
  const hydrated = useHydrated();
  const places = useStore(placesStore);
  const location = useStore(locationStore);
  const { locating, locate } = useLocate();

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const active = focused || query !== "";
  const search = usePlaceSearch(query);

  const refreshLocation = useEffectEvent(() => {
    if (locationStore.read().enabled) {
      void locate({ quiet: true });
    }
  });
  useEffect(() => {
    refreshLocation();
  }, []);

  const cancel = () => {
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <header>
        <h1
          className={cn(
            "overflow-hidden text-[34px] leading-[41px] font-bold transition-all duration-300",
            active ? "h-0 opacity-0" : "mb-2 h-[41px]",
          )}
        >
          {t("title")}
        </h1>
        <SearchField
          ref={inputRef}
          value={query}
          active={active}
          onChange={setQuery}
          onFocus={() => setFocused(true)}
          onCancel={cancel}
        />
      </header>

      {active
        ? <SearchResults search={search} />
        : hydrated && (
          <>
            <ul className="mt-4 space-y-3">
              <li>
                {location.enabled && location.last
                  ? <PlaceCell place={location.last} current onDelete={() => locationStore.write({ enabled: false, last: null })} />
                  : <LocationRow locating={locating} onLocate={() => void locate()} />}
              </li>
              {places.map(place => (
                <li key={placeKey(place)}>
                  <PlaceCell place={place} current={false} onDelete={() => removePlace(placeKey(place))} />
                </li>
              ))}
            </ul>
            {places.length === 0 && <p className="mt-6 text-center text-[15px] text-white/60">{t("empty")}</p>}
            <footer className="mt-10 space-y-1 text-center text-[13px] text-white/45">
              <p>{footer("data")}</p>
              <p>{footer("places")}</p>
            </footer>
          </>
        )}
    </div>
  );
}
