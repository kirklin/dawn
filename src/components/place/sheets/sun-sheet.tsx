"use client";

import type { Labels } from "../use-labels";
import type { SunYear } from "~/lib/astro/sun";
import type { PlaceForecast } from "~/lib/forecast/types";
import { useState } from "react";
import { Sheet } from "~/components/ios/sheet";
import { WeatherGlyph } from "~/components/sky/weather-glyph";
import { formatHour } from "~/lib/format";
import { cn } from "~/lib/utils";
import { SunArc } from "../sun-arc";
import { SunDayFacts } from "./sun-day-facts";
import { SunYearTable } from "./sun-year-table";

/** Hour labels under the chart sit on its grid lines plus the left edge: 0, 6, 12 and 18 o'clock. */
const GRID_FRACTIONS = [0, 0.25, 0.5, 0.75];

interface SunSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "sunrise" | "sunset";
  title: string;
  forecast: PlaceForecast;
  year: SunYear;
  now: number;
  labels: Labels;
}

export function SunSheet({ open, onOpenChange, kind, title, forecast, year, now, labels }: SunSheetProps) {
  const todayIndex = Math.max(0, forecast.days.findIndex(day => now >= day.start && now < day.end));
  const [selected, setSelected] = useState(todayIndex);
  const day = forecast.days[selected];
  const isToday = selected === todayIndex;
  const fraction = (time: number | null) => time === null ? null : (time - day.start) / (day.end - day.start);
  const marks = [fraction(day.firstLight), fraction(day.lastLight)].filter(mark => mark !== null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} icon={<WeatherGlyph kind={kind} className="size-6" />}>
      <div className="flex justify-between gap-1 py-2">
        {forecast.days.map((entry, index) => (
          <button
            key={entry.date}
            type="button"
            onClick={() => setSelected(index)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[13px]",
              index === selected ? "bg-white/20" : "text-white/70",
            )}
          >
            <span>{labels.day(entry.date, entry.start)}</span>
            <span className="text-[17px] font-semibold tabular-nums">{Number(entry.date.slice(8))}</span>
          </button>
        ))}
      </div>
      <SunDayFacts day={day} kind={kind} now={now} isToday={isToday} timeZone={forecast.timezone} labels={labels} />
      <div className="mt-4 rounded-2xl bg-white/[0.07] p-3">
        <SunArc
          altitudes={day.altitudes}
          progress={isToday ? (now - day.start) / (day.end - day.start) : null}
          marks={marks}
          height={180}
          grid
          className="w-full"
        />
        <div className="relative mt-1 h-4 text-[11px] text-white/60 tabular-nums">
          {GRID_FRACTIONS.map(position => (
            <span key={position} className="absolute pl-1" style={{ left: `${position * 100}%` }}>
              {formatHour(day.start + position * (day.end - day.start), forecast.timezone)}
            </span>
          ))}
        </div>
      </div>
      <SunYearTable year={year} labels={labels} timeZone={forecast.timezone} />
    </Sheet>
  );
}
