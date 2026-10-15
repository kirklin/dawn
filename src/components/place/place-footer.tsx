"use client";

import type { ModelRuns } from "~/lib/forecast/open-meteo";
import { useTranslations } from "next-intl";
import { formatRunTime } from "~/lib/format";

interface PlaceFooterProps {
  /** Null for the made-up example, which no data source is behind. */
  runs: ModelRuns | null;
  timeZone: string;
}

export function PlaceFooter({ runs, timeZone }: PlaceFooterProps) {
  const t = useTranslations("Place.footer");

  return (
    <footer className="mx-auto max-w-xl px-8 pt-5 text-[13px] leading-[18px] text-white/55">
      {runs
        ? (
            <>
              <p>{t("weather")}</p>
              <p>{t("map")}</p>
              <p className="tabular-nums">
                {t("runs", {
                  ecmwf: formatRunTime(runs.ecmwf, timeZone),
                  gfs: formatRunTime(runs.gfs, timeZone),
                  cams: formatRunTime(runs.cams, timeZone),
                })}
              </p>
            </>
          )
        : <p>{t("example")}</p>}
    </footer>
  );
}
