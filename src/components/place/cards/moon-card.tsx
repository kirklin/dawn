"use client";

import type { MoonOutlook } from "~/lib/forecast/types";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { MoonDisc } from "~/components/sky/moon-disc";
import { daysUntilQuarter, nextMoonCrossing } from "~/lib/forecast/selectors";
import { formatClock, formatPercent } from "~/lib/format";

interface MoonCardProps {
  moon: MoonOutlook;
  now: number;
  timeZone: string;
}

/** Tonight's moon as on the iOS moon card: the phase, how much of it is lit, the next moonrise or moonset, and the days to full moon. */
export function MoonCard({ moon, now, timeZone }: MoonCardProps) {
  const t = useTranslations("Place.moon");
  const common = useTranslations("Common");
  const next = nextMoonCrossing(moon, now);
  const daysToFull = daysUntilQuarter(moon.quarters, "full", now, timeZone);

  const rows = [
    { key: "illumination", label: t("illumination"), value: `${formatPercent(moon.state.illumination)}%` },
    ...(next ? [{ key: "crossing", label: t(next.kind), value: formatClock(next.time, timeZone) }] : []),
    ...(daysToFull === null
      ? []
      : [daysToFull === 0
          ? { key: "full", label: t("phase.full"), value: common("today") }
          : { key: "full", label: t("nextFull"), value: t("days", { count: daysToFull }) }]),
  ];

  return (
    <SkyCard wide title={t(`phase.${moon.state.phase}`)}>
      <div className="mt-1 flex items-center gap-4">
        <dl className="flex-1">
          {rows.map(row => (
            <div
              key={row.key}
              className="relative flex h-11 items-center justify-between gap-3 text-[17px] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/15 first:before:hidden"
            >
              <dt>{row.label}</dt>
              <dd className="text-white/60 tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <MoonDisc phaseAngle={moon.state.phaseAngle} className="size-[104px] shrink-0" />
      </div>
    </SkyCard>
  );
}
