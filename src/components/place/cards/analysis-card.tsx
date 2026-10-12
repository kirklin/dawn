"use client";

import type { GlowEvent } from "~/lib/forecast/types";
import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { SkyCard } from "~/components/ios/sky-card";
import { MODEL_DISAGREEMENT } from "~/lib/forecast/glow";
import { formatPercent, formatScore } from "~/lib/format";
import { percent } from "../glow-style";
import { meanFactor } from "../use-summary";

interface AnalysisCardProps {
  event: GlowEvent;
  dayLabel: string;
}

export function AnalysisCard({ event, dayLabel }: AnalysisCardProps) {
  const t = useTranslations("Place.analysis");
  const glow = useTranslations("Glow");
  const rows = [
    { key: "canvas", value: meanFactor(event, factors => factors.canvasCover) },
    { key: "transmission", value: meanFactor(event, factors => factors.transmission) },
    { key: "view", value: meanFactor(event, factors => factors.view) },
    { key: "aerosol", value: meanFactor(event, factors => factors.aerosol) },
  ] as const;

  return (
    <SkyCard wide title={t("title", { day: dayLabel, event: glow(`event.${event.kind}`) })} icon={Layers}>
      <dl className="space-y-2.5">
        {rows.map(row => (
          <div key={row.key} className="flex items-center gap-3 text-[15px]">
            <dt className="w-20 shrink-0">{t(row.key)}</dt>
            <dd className="relative h-1.5 flex-1 rounded-full bg-black/25">
              <span className="absolute inset-y-0 left-0 rounded-full bg-white/80" style={{ width: percent(row.value) }} />
            </dd>
            <dd className="w-11 shrink-0 text-right tabular-nums">{`${formatPercent(row.value)}%`}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-white/15 pt-3 text-[15px] tabular-nums">
        {t("models", {
          ecmwf: formatScore(event.models.ecmwf.score),
          gfs: formatScore(event.models.gfs.score),
        })}
      </p>
      <p className="text-[13px] text-white/60">{t(event.spread >= MODEL_DISAGREEMENT ? "disagree" : "agree")}</p>
    </SkyCard>
  );
}
