"use client";

import type { SearchState } from "./use-place-search";
import { useTranslations } from "next-intl";
import { Link } from "~/lib/i18n/navigation";
import { HOT_CITIES } from "~/lib/places/hot-cities";
import { placeHref } from "~/lib/places/store";

/** The popular cities, one tap from their forecast, while nothing has been typed. */
function HotCities() {
  const t = useTranslations("Places");

  return (
    <section className="mt-5">
      <h2 className="text-[13px] text-white/60">{t("hotCities")}</h2>
      <ul className="mt-2.5 grid grid-cols-4 gap-2.5">
        {HOT_CITIES.map(city => (
          <li key={city.name}>
            <Link href={placeHref(city)} className="flex h-10 items-center justify-center rounded-[10px] bg-[rgb(118_118_128/0.24)] text-[15px]">
              {city.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SearchResults({ search }: { search: SearchState }) {
  const t = useTranslations("Places");

  if (search.status === "idle") {
    return <HotCities />;
  }
  if (search.status !== "done" || search.results.length === 0) {
    const message = search.status === "loading"
      ? t("searching")
      : search.status === "error" ? t("searchFailed", { message: search.message }) : t("noResults");
    return <p className="pt-10 text-center text-[17px] break-all text-white/60">{message}</p>;
  }

  return (
    <ul className="mt-1">
      {search.results.map(result => (
        <li key={`${result.lat},${result.lon},${result.name}`} className="border-b border-white/10">
          <Link href={placeHref(result)} className="block py-3">
            <p className="text-[17px]">{result.name}</p>
            {result.detail && <p className="mt-0.5 text-[13px] text-white/60">{result.detail}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
