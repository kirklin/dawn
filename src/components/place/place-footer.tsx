"use client";

import type { ModelRuns } from "~/lib/forecast/open-meteo";
import { useTranslations } from "next-intl";
import { formatRunTime } from "~/lib/format";

interface PlaceFooterProps {
  runs: ModelRuns;
  timeZone: string;
}

export function PlaceFooter({ runs, timeZone }: PlaceFooterProps) {
  const t = useTranslations("Place.footer");

  return (
    <footer className="mx-auto max-w-xl space-y-1 px-6 pt-6 pb-4 text-center text-[13px] leading-snug text-white/60">
      <p>{t("data")}</p>
      <p className="tabular-nums">
        {t("runs", {
          ecmwf: formatRunTime(runs.ecmwf, timeZone),
          gfs: formatRunTime(runs.gfs, timeZone),
          cams: formatRunTime(runs.cams, timeZone),
        })}
      </p>
      <p>{t("places")}</p>
      <p>{t("disclaimer")}</p>
    </footer>
  );
}
