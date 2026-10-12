"use client";

import type { MoonOutlook } from "~/lib/forecast/types";
import { Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { MoonDisc } from "~/components/sky/moon-disc";
import { daysUntilQuarter, nextMoonCrossing } from "~/lib/forecast/selectors";
import { formatClock, formatPercent } from "~/lib/format";

interface MoonCardProps {
  moon: MoonOutlook;
  now: number;
  timeZone: string;
  onOpen: () => void;
}

/** Phase, illumination, the next moonrise or moonset and the days to full moon, as on the iOS moon tile. */
export function MoonCard({ moon, now, timeZone, onOpen }: MoonCardProps) {
  const t = useTranslations("Place.moon");
  const next = nextMoonCrossing(moon, now);
  const daysToFull = daysUntilQuarter(moon.quarters, "full", now, timeZone);
  const rows = [
    { key: "illumination", label: t("illumination"), value: `${formatPercent(moon.state.illumination)}%` },
    { key: "crossing", label: t(next?.kind ?? "moonrise"), value: next ? formatClock(next.time, timeZone) : t("none") },
    {
      key: "full",
      label: t("nextFull"),
      value: daysToFull === null ? "--" : daysToFull === 0 ? t("fullToday") : t("days", { count: daysToFull }),
    },
  ];

  return (
    <SkyCard wide title={t(`phase.${moon.state.phase}`)} icon={Moon} onClick={onOpen}>
      <div className="flex items-center gap-4">
        <dl className="flex-1 divide-y divide-white/15">
          {rows.map(row => (
            <div key={row.key} className="flex h-11 items-center justify-between text-[17px]">
              <dt>{row.label}</dt>
              <dd className="text-white/70 tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <MoonDisc phaseAngle={moon.state.phaseAngle} className="size-[104px] shrink-0" />
      </div>
    </SkyCard>
  );
}
