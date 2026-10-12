"use client";

import type { NightOutlook } from "~/lib/forecast/night";
import { Telescope } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { BEST_HOUR_SCORE, FAINT_MOON } from "~/lib/astro/constants";
import { aerosolLevel } from "~/lib/forecast/glow";
import { formatClock, formatHour, formatPercent } from "~/lib/format";

interface NightCardProps {
  night: NightOutlook | null;
  timeZone: string;
}

/** Tonight's stargazing outlook: dark window, clear and moonless hours, and air clarity. */
export function NightCard({ night, timeZone }: NightCardProps) {
  const t = useTranslations("Place.night");
  const aerosol = useTranslations("Place.aerosol");

  if (!night) {
    return (
      <SkyCard wide title={t("title")} icon={Telescope}>
        <p className="text-[17px]">{t("none")}</p>
      </SkyCard>
    );
  }

  const clock = (time: number) => formatClock(time, timeZone);
  const percent = formatPercent(night.moonIllumination);
  const moonInSky = night.hours.some(hour => hour.moonUp);
  const moonLine = night.moonIllumination < FAINT_MOON
    ? t("moonFaint", { percent })
    : moonInSky ? t("moonBright", { percent }) : t("moonDown", { percent });

  return (
    <SkyCard wide title={t("title")} icon={Telescope}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[34px] leading-tight">{t(`rating.${night.rating}`)}</p>
        <p className="text-[15px] text-white/70 tabular-nums">
          {night.best ? t("best", { start: clock(night.best[0]), end: clock(night.best[1]) }) : t("noBest")}
        </p>
      </div>
      <ol className="mt-3 flex h-16 items-end gap-[3px]" aria-hidden>
        {night.hours.map(hour => (
          <li
            key={hour.time}
            className="flex-1 rounded-[3px]"
            style={{
              height: `${Math.max(8, hour.score * 100)}%`,
              background: hour.moonUp && night.moonIllumination >= FAINT_MOON ? "#b8c6ff" : "white",
              opacity: hour.score >= BEST_HOUR_SCORE ? 0.9 : 0.4,
            }}
          />
        ))}
      </ol>
      <ol className="mt-1 flex gap-[3px] text-[11px] text-white/60 tabular-nums" aria-hidden>
        {night.hours.map((hour, index) => (
          <li key={hour.time} className="flex-1 text-center whitespace-nowrap">
            {index % 2 === 0 ? formatHour(hour.time, timeZone) : ""}
          </li>
        ))}
      </ol>
      <ul className="mt-3 space-y-1 border-t border-white/15 pt-3 text-[15px] leading-snug">
        <li>
          {night.darkness === "astronomical"
            ? t("window", { start: clock(night.start), end: clock(night.end) })
            : t("windowNautical", { start: clock(night.start), end: clock(night.end) })}
        </li>
        <li>{moonLine}</li>
        {night.aod !== null && <li>{t("transparency", { level: aerosol(`level.${aerosolLevel(night.aod)}`) })}</li>}
      </ul>
    </SkyCard>
  );
}
