"use client";

import type { Labels } from "../use-labels";
import type { SunDay } from "~/lib/astro/sun";
import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { CompassDial } from "../compass-dial";

const SUNRISE_COLOR = "#ffd60a";
const SUNSET_COLOR = "#ff9f0a";

interface AzimuthCardProps {
  day: SunDay;
  labels: Labels;
}

/** Where the sun rises and sets today, laid out like the iOS wind tile. */
export function AzimuthCard({ day, labels }: AzimuthCardProps) {
  const t = useTranslations("Place.azimuth");
  const glow = useTranslations("Glow");
  const rows = [
    { key: "sunrise", azimuth: day.sunriseAzimuth, color: SUNRISE_COLOR },
    { key: "sunset", azimuth: day.sunsetAzimuth, color: SUNSET_COLOR },
  ] as const;
  const markers = rows.flatMap(row => row.azimuth === null ? [] : [{ key: row.key, azimuth: row.azimuth, color: row.color }]);

  return (
    <SkyCard wide title={t("title")} icon={Compass}>
      <div className="flex items-center gap-4">
        <dl className="flex-1 divide-y divide-white/15">
          {rows.map(row => (
            <div key={row.key} className="flex h-12 items-center justify-between gap-2 text-[17px]">
              <dt className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: row.color }} />
                {glow(`sun.${row.key}`)}
              </dt>
              <dd className="text-[15px] text-white/70 tabular-nums">
                {row.azimuth === null
                  ? "--"
                  : t("value", { degrees: Math.round(row.azimuth), direction: labels.azimuth(row.azimuth) })}
              </dd>
            </div>
          ))}
        </dl>
        <CompassDial markers={markers} className="size-[112px] shrink-0" />
      </div>
    </SkyCard>
  );
}
