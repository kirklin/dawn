"use client";

import type { Labels } from "../use-labels";
import type { SunDay } from "~/lib/astro/sun";
import { useTranslations } from "next-intl";
import { formatClock } from "~/lib/format";

interface SunDayFactsProps {
  day: SunDay;
  kind: "sunrise" | "sunset";
  now: number;
  isToday: boolean;
  timeZone: string;
  labels: Labels;
}

export function SunDayFacts({ day, kind, now, isToday, timeZone, labels }: SunDayFactsProps) {
  const t = useTranslations("Place.sun");
  const glow = useTranslations("Glow");
  const clock = (time: number | null) => (time === null ? "--" : formatClock(time, timeZone));
  const daylight = day.sunrise !== null && day.sunset !== null ? day.sunset - day.sunrise : null;

  let caption: string | null = null;
  if (isToday && day.sunrise !== null && now < day.sunrise) {
    caption = t("untilSunrise", { duration: labels.duration(day.sunrise - now) });
  } else if (isToday && day.sunset !== null && now < day.sunset) {
    caption = t("remaining", { duration: labels.duration(day.sunset - now) });
  } else if (daylight !== null) {
    caption = t("daylight", { duration: labels.duration(daylight) });
  }

  const rows = [
    { label: t("firstLight"), value: clock(day.firstLight) },
    { label: glow("sun.sunrise"), value: clock(day.sunrise) },
    { label: glow("sun.sunset"), value: clock(day.sunset) },
    { label: t("lastLight"), value: clock(day.lastLight) },
    { label: t("totalDaylight"), value: daylight === null ? "--" : labels.duration(daylight) },
  ];

  return (
    <div>
      <p className="mt-2 text-[44px] leading-none font-light tabular-nums">{clock(day[kind])}</p>
      {caption && <p className="mt-2 text-[15px] text-white/70">{caption}</p>}
      <dl className="mt-4 divide-y divide-white/10 rounded-2xl bg-white/[0.07] px-4">
        {rows.map(row => (
          <div key={row.label} className="flex h-11 items-center justify-between text-[17px]">
            <dt>{row.label}</dt>
            <dd className="text-white/70 tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
