"use client";

import type { Labels } from "../use-labels";
import type { MoonQuarterName } from "~/lib/astro/moon";
import type { MoonOutlook } from "~/lib/forecast/types";
import { Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet } from "~/components/ios/sheet";
import { MoonDisc } from "~/components/sky/moon-disc";
import { formatClock, formatMonthDay, formatPercent, formatWeekday } from "~/lib/format";
import { zonedMidnight } from "~/lib/time/zoned";

const QUARTER_ANGLES: Record<MoonQuarterName, number> = { new: 0, firstQuarter: 90, full: 180, thirdQuarter: 270 };

interface MoonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moon: MoonOutlook;
  timeZone: string;
  labels: Labels;
}

export function MoonSheet({ open, onOpenChange, moon, timeZone, labels }: MoonSheetProps) {
  const t = useTranslations("Place.moon");
  const clock = (time: number | null) => (time === null ? t("none") : formatClock(time, timeZone));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("title")} icon={<Moon className="size-5" />}>
      <div className="flex flex-col items-center pt-4">
        <MoonDisc phaseAngle={moon.state.phaseAngle} className="size-40" />
        <p className="mt-4 text-[28px] font-semibold">{t(`phase.${moon.state.phase}`)}</p>
        <p className="text-[15px] text-white/70 tabular-nums">
          {t("illuminationValue", { percent: formatPercent(moon.state.illumination) })}
        </p>
      </div>

      <h3 className="mt-6 text-[20px] font-semibold">{t("riseSet")}</h3>
      <ul className="mt-3 divide-y divide-white/10 rounded-2xl bg-white/[0.07] px-4">
        {moon.days.map(day => (
          <li key={day.date} className="flex h-11 items-center gap-3 text-[15px] tabular-nums">
            <span className="w-12 shrink-0 font-semibold">{labels.day(day.date, zonedMidnight(day.date, timeZone))}</span>
            <span className="flex-1 text-white/70">{`${t("moonrise")} ${clock(day.rise)}`}</span>
            <span className="flex-1 text-right text-white/70">{`${t("moonset")} ${clock(day.set)}`}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-[20px] font-semibold">{t("upcoming")}</h3>
      <ul className="mt-3 divide-y divide-white/10 rounded-2xl bg-white/[0.07] px-4">
        {moon.quarters.map(quarter => (
          <li key={quarter.time} className="flex h-14 items-center gap-3">
            <MoonDisc phaseAngle={QUARTER_ANGLES[quarter.quarter]} className="size-8 shrink-0" />
            <span className="flex-1 text-[17px]">{t(`phase.${quarter.quarter}`)}</span>
            <span className="text-[15px] text-white/70 tabular-nums">
              {`${formatMonthDay(quarter.time, timeZone)} ${formatWeekday(quarter.time, timeZone)} ${formatClock(quarter.time, timeZone)}`}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
