"use client";

import type { SunDay } from "~/lib/astro/sun";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { nextLightSession } from "~/lib/forecast/selectors";
import { formatClock } from "~/lib/format";

interface GoldenHourCardProps {
  days: SunDay[];
  now: number;
  timeZone: string;
}

export function GoldenHourCard({ days, now, timeZone }: GoldenHourCardProps) {
  const t = useTranslations("Place.golden");
  const session = nextLightSession(days, now);
  const range = (value: readonly [number, number] | null) =>
    value ? `${formatClock(value[0], timeZone)}–${formatClock(value[1], timeZone)}` : "--";
  const rows = session && [
    { key: "golden", color: "#ffc861", range: session.golden },
    { key: "blue", color: "#6e8bff", range: session.blue },
  ] as const;

  return (
    <SkyCard title={t("title")} icon={Sparkles}>
      {session && rows
        ? (
            <>
              <p className="text-[34px] leading-tight tabular-nums">
                {now >= session.start ? t("ongoing") : formatClock(session.start, timeZone)}
              </p>
              <p className="text-[15px] text-white/70">{t(session.period)}</p>
              <dl className="mt-2.5 space-y-1.5">
                {(session.period === "morning" ? [...rows].reverse() : rows).map(row => (
                  <div key={row.key}>
                    <dt className="flex items-center gap-1.5 text-[13px] text-white/70">
                      <span className="size-2 rounded-full" style={{ background: row.color }} />
                      {t(row.key)}
                    </dt>
                    <dd className="text-[17px] tabular-nums">{range(row.range)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )
        : <p className="text-[15px] text-white/70">{t("none")}</p>}
    </SkyCard>
  );
}
