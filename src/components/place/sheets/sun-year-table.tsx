"use client";

import type { Labels } from "../use-labels";
import type { SunYear } from "~/lib/astro/sun";
import { useTranslations } from "next-intl";
import { formatMinutesOfDay, formatMonthDay } from "~/lib/format";
import { MINUTE_MS, zonedMidnight } from "~/lib/time/zoned";

const DAY_MINUTES = 24 * 60;

interface SunYearTableProps {
  year: SunYear;
  labels: Labels;
  timeZone: string;
}

export function SunYearTable({ year, labels, timeZone }: SunYearTableProps) {
  const t = useTranslations("Place.sun");
  const longest = year.longestDay;

  return (
    <section className="mt-6">
      <h3 className="text-[20px] font-semibold">{t("averages")}</h3>
      {longest && (
        <p className="mt-1 text-[15px] text-white/60">
          {t("longest", {
            duration: labels.duration(longest.minutes * MINUTE_MS),
            date: formatMonthDay(zonedMidnight(longest.date, timeZone), timeZone),
          })}
        </p>
      )}
      <ul className="mt-3 divide-y divide-white/10 rounded-2xl bg-white/[0.07] px-4">
        {year.months.map(month => (
          <li key={month.month} className="flex h-11 items-center gap-3 text-[15px] tabular-nums">
            <span className="w-9 shrink-0 font-semibold">{t("month", { month: month.month })}</span>
            <span className="w-12 shrink-0 text-white/70">{month.sunrise === null ? "--" : formatMinutesOfDay(month.sunrise)}</span>
            <span className="relative h-1.5 flex-1 rounded-full bg-white/10">
              {month.sunrise !== null && month.sunset !== null && (
                <span
                  className="absolute inset-y-0 rounded-full bg-[#64d2ff]"
                  style={{ left: `${(month.sunrise / DAY_MINUTES) * 100}%`, right: `${100 - (month.sunset / DAY_MINUTES) * 100}%` }}
                />
              )}
            </span>
            <span className="w-12 shrink-0 text-right text-white/70">{month.sunset === null ? "--" : formatMinutesOfDay(month.sunset)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
