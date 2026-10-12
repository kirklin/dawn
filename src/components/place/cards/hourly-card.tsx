"use client";

import type { GlyphKind } from "~/components/sky/glyphs";
import type { PlaceForecast } from "~/lib/forecast/types";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { glyphFor } from "~/components/sky/glyphs";
import { WeatherGlyph } from "~/components/sky/weather-glyph";
import { sunAltitudeAt } from "~/lib/forecast/selectors";
import { formatClock, formatHour, formatPercent } from "~/lib/format";
import { DAY_MS, HOUR_MS } from "~/lib/time/zoned";

interface Item {
  key: string;
  time: number;
  label: string;
  glyph: GlyphKind;
  value: string;
}

interface HourlyCardProps {
  forecast: PlaceForecast;
  now: number;
  summary: string | null;
}

export function HourlyCard({ forecast, now, summary }: HourlyCardProps) {
  const t = useTranslations("Place.hourly");
  const glow = useTranslations("Glow");
  const { timezone } = forecast;

  const firstHour = forecast.hours.findIndex(hour => hour.time + HOUR_MS > now);
  const hours = forecast.hours.slice(firstHour, firstHour + 24);
  const items: Item[] = hours.map((hour, index) => ({
    key: String(hour.time),
    time: hour.time,
    label: index === 0 ? t("now") : formatHour(hour.time, timezone),
    glyph: glyphFor(hour.cloud, hour.precipitation, (sunAltitudeAt(forecast.days, hour.time + HOUR_MS / 2) ?? -90) > 0),
    value: `${formatPercent(hour.cloud)}%`,
  }));

  for (const day of forecast.days) {
    for (const kind of ["sunrise", "sunset"] as const) {
      const time = day[kind];
      if (time !== null && time > now && time < now + DAY_MS) {
        items.push({ key: `${day.date}-${kind}`, time, label: formatClock(time, timezone), glyph: kind, value: glow(`sun.${kind}`) });
      }
    }
  }
  items.sort((a, b) => a.time - b.time);

  return (
    <SkyCard wide title={t("title")} icon={Clock} bodyClassName="px-0">
      {summary && (
        <p className="mx-4 border-b border-white/15 pb-3 text-[15px] leading-snug text-white">{summary}</p>
      )}
      <ol data-swipe-ignore className="no-scrollbar flex overflow-x-auto px-2 pt-3">
        {items.map(item => (
          <li key={item.key} className="flex w-14 shrink-0 flex-col items-center gap-2.5">
            <span className="text-[15px] font-medium whitespace-nowrap">{item.label}</span>
            <WeatherGlyph kind={item.glyph} className="size-7" />
            <span className="text-[17px] font-medium whitespace-nowrap tabular-nums">{item.value}</span>
          </li>
        ))}
      </ol>
    </SkyCard>
  );
}
