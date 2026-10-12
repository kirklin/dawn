"use client";

import type { SearchState } from "./use-place-search";
import { useTranslations } from "next-intl";
import { Link } from "~/lib/i18n/navigation";
import { placeHref } from "~/lib/places/store";

export function SearchResults({ search }: { search: SearchState }) {
  const t = useTranslations("Places");

  if (search.status === "idle") {
    return null;
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
          <Link href={placeHref(result, { preview: true })} className="block py-3">
            <p className="text-[17px]">{result.name}</p>
            {result.detail && <p className="mt-0.5 text-[13px] text-white/60">{result.detail}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
