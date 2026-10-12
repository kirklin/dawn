"use client";

import type { SunDay } from "~/lib/astro/sun";
import { Sunrise, Sunset } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { nextSunCrossing } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";
import { SunArc } from "../sun-arc";

interface SunCardProps {
  days: SunDay[];
  now: number;
  timeZone: string;
  onOpen: () => void;
}

export function SunCard({ days, now, timeZone, onOpen }: SunCardProps) {
  const t = useTranslations("Place.sun");
  const glow = useTranslations("Glow");
  const today = days.find(day => now >= day.start && now < day.end) ?? days[0];
  const next = nextSunCrossing(days, now);
  const kind = next?.kind ?? "sunset";
  const other = kind === "sunset" ? today.sunrise : today.sunset;

  return (
    <SkyCard title={glow(`sun.${kind}`)} icon={kind === "sunset" ? Sunset : Sunrise} onClick={onOpen}>
      <p className="text-[34px] leading-tight font-normal tabular-nums">
        {next ? formatClock(next.time, timeZone) : t(today.altitudes.some(altitude => altitude > 0) ? "polarDay" : "polarNight")}
      </p>
      <SunArc
        altitudes={today.altitudes}
        progress={(now - today.start) / (today.end - today.start)}
        height={110}
        className="mt-2 w-full"
      />
      {other !== null && (
        <p className="mt-2 text-[15px] tabular-nums">
          {t(kind === "sunset" ? "bottomSunrise" : "bottomSunset", { time: formatClock(other, timeZone) })}
        </p>
      )}
    </SkyCard>
  );
}
